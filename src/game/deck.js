class Deck {
  constructor() {
    this.cards = [];
    this.initDeck();
  }
  initDeck() {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    for (let suit of suits) {
      for (let value of values) {
        this.cards.push({
          suit,
          value
        });
      }
    }
  }
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }
  drawCard() {
    if (this.cards.length === 0) {
      throw new Error("No hay más cartas en la baraja");
    }
    return this.cards.pop();
  }
}
module.exports = Deck;