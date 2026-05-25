use dashmap::DashMap;
use pp_domain::participant::Role;
use pp_domain::room::DeckType;
use pp_events::{DomainEvent, RoomEvent, SessionEvent, VoteEvent};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ParticipantView {
    pub id: String,
    pub display_name: String,
    pub role: Role,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VoteView {
    pub participant_id: String,
    pub card: Option<String>,
    pub has_voted: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionView {
    pub id: String,
    pub ticket_id: Option<String>,
    pub ticket_description: Option<String>,
    pub revealed: bool,
    pub votes: Vec<VoteView>,
    pub final_estimate: Option<String>,
    pub jira_issue_key: Option<String>,
    pub jira_push_status: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TicketView {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub jira_issue_key: Option<String>,
    pub jira_url: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct RoomView {
    pub id: String,
    pub name: String,
    pub deck_type: DeckType,
    pub facilitator_id: String,
    pub participants: Vec<ParticipantView>,
    pub active_session: Option<SessionView>,
    pub ticket_queue: Vec<TicketView>,
}

/// Pure event application for a single room. Used by the Durable Object worker.
/// votes: (session_id, participant_id) → card string, kept hidden until reveal.
pub fn apply_event(
    room: &mut RoomView,
    votes: &mut HashMap<(String, String), String>,
    event: &DomainEvent,
) {
    match event {
        DomainEvent::Room(e) => apply_room_event(room, e),
        DomainEvent::Session(e) => apply_session_event(room, votes, e),
        DomainEvent::Vote(e) => apply_vote_event(room, votes, e),
    }
}

fn apply_room_event(room: &mut RoomView, event: &RoomEvent) {
    match event {
        RoomEvent::RoomCreated {
            room_id,
            name,
            deck_type,
            facilitator_id,
            ..
        } => {
            *room = RoomView {
                id: room_id.clone(),
                name: name.clone(),
                deck_type: *deck_type,
                facilitator_id: facilitator_id.clone(),
                participants: vec![],
                active_session: None,
                ticket_queue: vec![],
            };
        }
        RoomEvent::ParticipantJoined {
            participant_id,
            display_name,
            role,
            ..
        } => {
            if !room.participants.iter().any(|p| p.id == *participant_id) {
                room.participants.push(ParticipantView {
                    id: participant_id.clone(),
                    display_name: display_name.clone(),
                    role: *role,
                });
            }
        }
        RoomEvent::ParticipantLeft { participant_id, .. } => {
            room.participants.retain(|p| p.id != *participant_id);
        }
        RoomEvent::ParticipantRenamed {
            participant_id,
            new_name,
            ..
        } => {
            if let Some(p) = room.participants.iter_mut().find(|p| p.id == *participant_id) {
                p.display_name = new_name.clone();
            }
        }
        RoomEvent::ParticipantRoleChanged {
            participant_id,
            new_role,
            ..
        } => {
            if let Some(p) = room.participants.iter_mut().find(|p| p.id == *participant_id) {
                p.role = *new_role;
            }
        }
        RoomEvent::TicketAdded {
            ticket_id,
            title,
            description,
            ..
        } => {
            room.ticket_queue.push(TicketView {
                id: ticket_id.clone(),
                title: title.clone(),
                description: description.clone(),
                jira_issue_key: None,
                jira_url: None,
            });
        }
        RoomEvent::JiraTicketImported {
            issue_key,
            summary,
            description,
            jira_base_url,
            ..
        } => {
            if !room.ticket_queue.iter().any(|t| t.id == *issue_key) {
                room.ticket_queue.push(TicketView {
                    id: issue_key.clone(),
                    title: summary.clone(),
                    description: description.clone(),
                    jira_issue_key: Some(issue_key.clone()),
                    jira_url: Some(format!("{}/browse/{}", jira_base_url, issue_key)),
                });
            }
        }
    }
}

fn apply_session_event(
    room: &mut RoomView,
    votes: &mut HashMap<(String, String), String>,
    event: &SessionEvent,
) {
    match event {
        SessionEvent::SessionStarted {
            session_id,
            ticket_id,
            ticket_description,
            ..
        } => {
            let (tid, tdesc, jira_key) = if ticket_id.is_some() {
                (ticket_id.clone(), ticket_description.clone(), None)
            } else if !room.ticket_queue.is_empty() {
                let t = room.ticket_queue.remove(0);
                let jira = t.jira_issue_key.clone();
                (Some(t.title), t.description, jira)
            } else {
                (None, None, None)
            };
            room.active_session = Some(SessionView {
                id: session_id.clone(),
                ticket_id: tid,
                ticket_description: tdesc,
                revealed: false,
                votes: vec![],
                final_estimate: None,
                jira_issue_key: jira_key,
                jira_push_status: None,
            });
        }
        SessionEvent::SessionEnded {
            session_id,
            final_estimate,
            ..
        } => {
            if let Some(session) = room.active_session.as_mut() {
                if session.id == *session_id {
                    session.revealed = true;
                    session.final_estimate = final_estimate.clone();
                    for vote in session.votes.iter_mut() {
                        let key = (session_id.clone(), vote.participant_id.clone());
                        if let Some(card) = votes.get(&key) {
                            vote.card = Some(card.clone());
                        }
                    }
                }
            }
        }
        SessionEvent::SessionReset { session_id, .. } => {
            if room
                .active_session
                .as_ref()
                .is_some_and(|s| s.id == *session_id)
            {
                room.active_session = None;
            }
        }
    }
}

fn apply_vote_event(
    room: &mut RoomView,
    votes: &mut HashMap<(String, String), String>,
    event: &VoteEvent,
) {
    match event {
        VoteEvent::VoteCast {
            session_id,
            room_id: _,
            participant_id,
            card,
            ..
        } => {
            let card_str = card.to_string();
            votes.insert((session_id.clone(), participant_id.clone()), card_str);

            if let Some(session) = room.active_session.as_mut() {
                if session.id == *session_id {
                    let existing = session
                        .votes
                        .iter_mut()
                        .find(|v| v.participant_id == *participant_id);
                    if let Some(v) = existing {
                        v.has_voted = true;
                        v.card = None;
                    } else {
                        session.votes.push(VoteView {
                            participant_id: participant_id.clone(),
                            card: None,
                            has_voted: true,
                        });
                    }
                }
            }
        }
        VoteEvent::VoteRetracted {
            session_id,
            room_id: _,
            participant_id,
            ..
        } => {
            votes.remove(&(session_id.clone(), participant_id.clone()));

            if let Some(session) = room.active_session.as_mut() {
                if session.id == *session_id {
                    session
                        .votes
                        .retain(|v| v.participant_id != *participant_id);
                }
            }
        }
    }
}

/// In-memory store of room read models keyed by room_id.
/// Used by the existing Axum gateway; depends on DashMap for concurrent access.
pub struct RoomProjection {
    rooms: Arc<DashMap<String, RoomView>>,
    votes: Arc<DashMap<(String, String), String>>,
}

impl RoomProjection {
    pub fn new() -> Self {
        Self {
            rooms: Arc::new(DashMap::new()),
            votes: Arc::new(DashMap::new()),
        }
    }

    pub fn get(&self, room_id: &str) -> Option<RoomView> {
        self.rooms.get(room_id).map(|r| r.clone())
    }

    pub fn apply(&self, event: &DomainEvent) {
        match event {
            DomainEvent::Room(e) => self.apply_room(e),
            DomainEvent::Session(e) => self.apply_session(e),
            DomainEvent::Vote(e) => self.apply_vote(e),
        }
    }

    fn apply_room(&self, event: &RoomEvent) {
        match event {
            RoomEvent::RoomCreated {
                room_id,
                name,
                deck_type,
                facilitator_id,
                ..
            } => {
                self.rooms.insert(
                    room_id.clone(),
                    RoomView {
                        id: room_id.clone(),
                        name: name.clone(),
                        deck_type: *deck_type,
                        facilitator_id: facilitator_id.clone(),
                        participants: vec![],
                        active_session: None,
                        ticket_queue: vec![],
                    },
                );
            }
            RoomEvent::ParticipantJoined {
                room_id,
                participant_id,
                display_name,
                role,
                ..
            } => {
                if let Some(mut room) = self.rooms.get_mut(room_id) {
                    room.participants.push(ParticipantView {
                        id: participant_id.clone(),
                        display_name: display_name.clone(),
                        role: *role,
                    });
                }
            }
            RoomEvent::ParticipantLeft {
                room_id,
                participant_id,
                ..
            } => {
                if let Some(mut room) = self.rooms.get_mut(room_id) {
                    room.participants.retain(|p| p.id != *participant_id);
                }
            }
            RoomEvent::ParticipantRenamed {
                room_id,
                participant_id,
                new_name,
                ..
            } => {
                if let Some(mut room) = self.rooms.get_mut(room_id) {
                    if let Some(p) = room
                        .participants
                        .iter_mut()
                        .find(|p| p.id == *participant_id)
                    {
                        p.display_name = new_name.clone();
                    }
                }
            }
            RoomEvent::ParticipantRoleChanged {
                room_id,
                participant_id,
                new_role,
                ..
            } => {
                if let Some(mut room) = self.rooms.get_mut(room_id) {
                    if let Some(p) = room
                        .participants
                        .iter_mut()
                        .find(|p| p.id == *participant_id)
                    {
                        p.role = *new_role;
                    }
                }
            }
            RoomEvent::TicketAdded {
                room_id,
                ticket_id,
                title,
                description,
                ..
            } => {
                if let Some(mut room) = self.rooms.get_mut(room_id) {
                    room.ticket_queue.push(TicketView {
                        id: ticket_id.clone(),
                        title: title.clone(),
                        description: description.clone(),
                        jira_issue_key: None,
                        jira_url: None,
                    });
                }
            }
            RoomEvent::JiraTicketImported {
                room_id,
                issue_key,
                summary,
                description,
                jira_base_url,
                ..
            } => {
                if let Some(mut room) = self.rooms.get_mut(room_id) {
                    if !room.ticket_queue.iter().any(|t| t.id == *issue_key) {
                        room.ticket_queue.push(TicketView {
                            id: issue_key.clone(),
                            title: summary.clone(),
                            description: description.clone(),
                            jira_issue_key: Some(issue_key.clone()),
                            jira_url: Some(format!("{}/browse/{}", jira_base_url, issue_key)),
                        });
                    }
                }
            }
        }
    }

    fn apply_session(&self, event: &SessionEvent) {
        match event {
            SessionEvent::SessionStarted {
                session_id,
                room_id,
                ticket_id,
                ticket_description,
                ..
            } => {
                if let Some(mut room) = self.rooms.get_mut(room_id) {
                    let (tid, tdesc, jira_key) = if ticket_id.is_some() {
                        (ticket_id.clone(), ticket_description.clone(), None)
                    } else if !room.ticket_queue.is_empty() {
                        let t = room.ticket_queue.remove(0);
                        let jira = t.jira_issue_key.clone();
                        (Some(t.title), t.description, jira)
                    } else {
                        (None, None, None)
                    };
                    room.active_session = Some(SessionView {
                        id: session_id.clone(),
                        ticket_id: tid,
                        ticket_description: tdesc,
                        revealed: false,
                        votes: vec![],
                        final_estimate: None,
                        jira_issue_key: jira_key,
                        jira_push_status: None,
                    });
                }
            }
            SessionEvent::SessionEnded {
                room_id,
                session_id,
                final_estimate,
                ..
            } => {
                if let Some(mut room) = self.rooms.get_mut(room_id) {
                    if let Some(session) = room.active_session.as_mut() {
                        if session.id == *session_id {
                            session.revealed = true;
                            session.final_estimate = final_estimate.clone();
                            for vote in session.votes.iter_mut() {
                                let key = (session_id.clone(), vote.participant_id.clone());
                                if let Some(card) = self.votes.get(&key) {
                                    vote.card = Some(card.clone());
                                }
                            }
                        }
                    }
                }
            }
            SessionEvent::SessionReset {
                room_id,
                session_id,
                ..
            } => {
                if let Some(mut room) = self.rooms.get_mut(room_id) {
                    if room
                        .active_session
                        .as_ref()
                        .is_some_and(|s| s.id == *session_id)
                    {
                        room.active_session = None;
                    }
                }
            }
        }
    }

    fn apply_vote(&self, event: &VoteEvent) {
        match event {
            VoteEvent::VoteCast {
                session_id,
                room_id,
                participant_id,
                card,
                ..
            } => {
                let card_str = card.to_string();
                self.votes
                    .insert((session_id.clone(), participant_id.clone()), card_str);

                if let Some(mut room) = self.rooms.get_mut(room_id) {
                    if let Some(session) = room.active_session.as_mut() {
                        if session.id == *session_id {
                            let existing = session
                                .votes
                                .iter_mut()
                                .find(|v| v.participant_id == *participant_id);
                            if let Some(v) = existing {
                                v.has_voted = true;
                                v.card = None;
                            } else {
                                session.votes.push(VoteView {
                                    participant_id: participant_id.clone(),
                                    card: None,
                                    has_voted: true,
                                });
                            }
                        }
                    }
                }
            }
            VoteEvent::VoteRetracted {
                session_id,
                room_id,
                participant_id,
                ..
            } => {
                self.votes
                    .remove(&(session_id.clone(), participant_id.clone()));

                if let Some(mut room) = self.rooms.get_mut(room_id) {
                    if let Some(session) = room.active_session.as_mut() {
                        if session.id == *session_id {
                            session
                                .votes
                                .retain(|v| v.participant_id != *participant_id);
                        }
                    }
                }
            }
        }
    }
}

impl Default for RoomProjection {
    fn default() -> Self {
        Self::new()
    }
}
