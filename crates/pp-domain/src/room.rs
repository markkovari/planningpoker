use std::fmt;

#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct RoomId(pub String);

impl fmt::Display for RoomId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DeckType {
    Fibonacci,
    TShirt,
}

#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[derive(Clone, Debug)]
pub struct Room {
    pub id: RoomId,
    pub name: String,
    pub deck_type: DeckType,
}

impl Room {
    pub fn new(id: impl Into<String>, name: impl Into<String>, deck_type: DeckType) -> Self {
        Self {
            id: RoomId(id.into()),
            name: name.into(),
            deck_type,
        }
    }
}
