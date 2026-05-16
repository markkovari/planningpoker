use dashmap::DashMap;
use pp_domain::participant::Role;
use pp_domain::room::DeckType;
use pp_events::{DomainEvent, RoomEvent, SessionEvent, VoteEvent};
use serde::{Deserialize, Serialize};
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
    pub card: Option<String>, // None until revealed
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
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TicketView {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RoomView {
    pub id: String,
    pub name: String,
    pub deck_type: DeckType,
    pub participants: Vec<ParticipantView>,
    pub active_session: Option<SessionView>,
    pub ticket_queue: Vec<TicketView>,
}

/// In-memory store of room read models, keyed by room_id.
pub struct RoomProjection {
    rooms: Arc<DashMap<String, RoomView>>,
    /// raw votes stored until revealed: (session_id, participant_id) -> card string
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
                let initial_participants = if facilitator_id.is_empty() {
                    vec![]
                } else {
                    vec![ParticipantView {
                        id: facilitator_id.clone(),
                        display_name: "Facilitator".to_string(),
                        role: Role::Facilitator,
                    }]
                };
                self.rooms.insert(
                    room_id.clone(),
                    RoomView {
                        id: room_id.clone(),
                        name: name.clone(),
                        deck_type: *deck_type,
                        participants: initial_participants,
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
                    });
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
                    // If no explicit ticket supplied, pop the front of the queue.
                    let (tid, tdesc) = if ticket_id.is_some() {
                        (ticket_id.clone(), ticket_description.clone())
                    } else if !room.ticket_queue.is_empty() {
                        let t = room.ticket_queue.remove(0);
                        (Some(t.title), t.description)
                    } else {
                        (None, None)
                    };
                    room.active_session = Some(SessionView {
                        id: session_id.clone(),
                        ticket_id: tid,
                        ticket_description: tdesc,
                        revealed: false,
                        votes: vec![],
                        final_estimate: None,
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
                            // fill in hidden cards now revealed
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
                                v.card = None; // hidden until reveal
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
