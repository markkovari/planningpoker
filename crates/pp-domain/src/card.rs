use std::fmt;
use std::str::FromStr;

#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FibonacciCard {
    Zero,
    One,
    Two,
    Three,
    Five,
    Eight,
    Thirteen,
    TwentyOne,
    ThirtyFour,
    FiftyFive,
    EightyNine,
    Question,
    Coffee,
}

impl FromStr for FibonacciCard {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "0" => Ok(FibonacciCard::Zero),
            "1" => Ok(FibonacciCard::One),
            "2" => Ok(FibonacciCard::Two),
            "3" => Ok(FibonacciCard::Three),
            "5" => Ok(FibonacciCard::Five),
            "8" => Ok(FibonacciCard::Eight),
            "13" => Ok(FibonacciCard::Thirteen),
            "21" => Ok(FibonacciCard::TwentyOne),
            "34" => Ok(FibonacciCard::ThirtyFour),
            "55" => Ok(FibonacciCard::FiftyFive),
            "89" => Ok(FibonacciCard::EightyNine),
            "?" => Ok(FibonacciCard::Question),
            "☕" | "coffee" => Ok(FibonacciCard::Coffee),
            _ => Err(format!("invalid fibonacci card: {s}")),
        }
    }
}

impl fmt::Display for FibonacciCard {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            FibonacciCard::Zero => "0",
            FibonacciCard::One => "1",
            FibonacciCard::Two => "2",
            FibonacciCard::Three => "3",
            FibonacciCard::Five => "5",
            FibonacciCard::Eight => "8",
            FibonacciCard::Thirteen => "13",
            FibonacciCard::TwentyOne => "21",
            FibonacciCard::ThirtyFour => "34",
            FibonacciCard::FiftyFive => "55",
            FibonacciCard::EightyNine => "89",
            FibonacciCard::Question => "?",
            FibonacciCard::Coffee => "☕",
        };
        write!(f, "{s}")
    }
}

#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TShirtCard {
    XS,
    S,
    M,
    L,
    XL,
    XXL,
    Question,
    Coffee,
}

impl FromStr for TShirtCard {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "XS" | "xs" => Ok(TShirtCard::XS),
            "S" | "s" => Ok(TShirtCard::S),
            "M" | "m" => Ok(TShirtCard::M),
            "L" | "l" => Ok(TShirtCard::L),
            "XL" | "xl" => Ok(TShirtCard::XL),
            "XXL" | "xxl" => Ok(TShirtCard::XXL),
            "?" => Ok(TShirtCard::Question),
            "☕" | "coffee" => Ok(TShirtCard::Coffee),
            _ => Err(format!("invalid t-shirt card: {s}")),
        }
    }
}

impl fmt::Display for TShirtCard {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            TShirtCard::XS => "XS",
            TShirtCard::S => "S",
            TShirtCard::M => "M",
            TShirtCard::L => "L",
            TShirtCard::XL => "XL",
            TShirtCard::XXL => "XXL",
            TShirtCard::Question => "?",
            TShirtCard::Coffee => "☕",
        };
        write!(f, "{s}")
    }
}

#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Card {
    Fibonacci(FibonacciCard),
    TShirt(TShirtCard),
}

impl Card {
    pub fn is_question(&self) -> bool {
        matches!(
            self,
            Card::Fibonacci(FibonacciCard::Question) | Card::TShirt(TShirtCard::Question)
        )
    }

    pub fn is_coffee(&self) -> bool {
        matches!(
            self,
            Card::Fibonacci(FibonacciCard::Coffee) | Card::TShirt(TShirtCard::Coffee)
        )
    }
}

impl FromStr for Card {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        if let Ok(c) = s.parse::<FibonacciCard>() {
            return Ok(Card::Fibonacci(c));
        }
        if let Ok(c) = s.parse::<TShirtCard>() {
            return Ok(Card::TShirt(c));
        }
        Err(format!("invalid card: {s}"))
    }
}

impl fmt::Display for Card {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Card::Fibonacci(c) => write!(f, "{c}"),
            Card::TShirt(c) => write!(f, "{c}"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_fibonacci() {
        assert_eq!(
            "13".parse::<Card>().unwrap(),
            Card::Fibonacci(FibonacciCard::Thirteen)
        );
        assert_eq!(
            "☕".parse::<Card>().unwrap(),
            Card::Fibonacci(FibonacciCard::Coffee)
        );
        assert_eq!(
            "coffee".parse::<Card>().unwrap(),
            Card::Fibonacci(FibonacciCard::Coffee)
        );
    }

    #[test]
    fn parse_tshirt() {
        assert_eq!("XL".parse::<Card>().unwrap(), Card::TShirt(TShirtCard::XL));
        assert_eq!("xl".parse::<Card>().unwrap(), Card::TShirt(TShirtCard::XL));
    }

    #[test]
    fn display_roundtrip() {
        for s in [
            "0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "?", "☕",
        ] {
            let card: Card = s.parse().unwrap();
            assert_eq!(card.to_string(), s);
        }
        for s in ["XS", "S", "M", "L", "XL", "XXL"] {
            let card: Card = s.parse().unwrap();
            assert_eq!(card.to_string(), s);
        }
    }
}
