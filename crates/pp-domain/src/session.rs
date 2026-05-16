use std::fmt;

#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct SessionId(pub String);

impl fmt::Display for SessionId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SessionStatus {
    Voting,
    Revealed,
}

#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[derive(Clone, Debug)]
pub struct Session {
    pub id: SessionId,
    pub ticket_id: Option<String>,
    pub ticket_description: Option<String>,
    pub status: SessionStatus,
}

impl Session {
    pub fn new(id: impl Into<String>) -> Self {
        Self {
            id: SessionId(id.into()),
            ticket_id: None,
            ticket_description: None,
            status: SessionStatus::Voting,
        }
    }
}
