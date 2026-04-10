/**
 * Función provisional para evaluar manos
 * El código actual espera que el Host decida manualmente al ganador.
 * 
 * Más adelante se puede conectar una librería evaluadora o el algoritmo de
 * evaluación Texas Hold'em.
 */

function evaluateHand(playerCards, communityCards) {
  return {
    rank: "High Card",
    score: 0,
    cards: [...playerCards]
  };
}
module.exports = {
  evaluateHand
};