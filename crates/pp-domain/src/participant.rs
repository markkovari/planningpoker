use std::fmt;

#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct ParticipantId(pub String);

impl fmt::Display for ParticipantId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Role {
    Facilitator,
    Voter,
    Observer,
}

#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[derive(Clone, Debug)]
pub struct Participant {
    pub id: ParticipantId,
    pub display_name: String,
    pub role: Role,
}

impl Participant {
    pub fn new(id: impl Into<String>, display_name: impl Into<String>, role: Role) -> Self {
        Self {
            id: ParticipantId(id.into()),
            display_name: display_name.into(),
            role,
        }
    }
}
