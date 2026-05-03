// Génération mot de passe aléatoire avec nom/prénom + chiffres/symboles
function generatePassword(nom, prenom) {
  // Nettoyer nom et prénom
  const cleanNom = nom.replace(/\s+/g, '').substring(0, 4);
  const cleanPrenom = prenom.replace(/\s+/g, '').substring(0, 4);
  
  // Base : Prénom + Nom (ex: AhmedSalem)
  let base = cleanPrenom.charAt(0).toUpperCase() + 
             cleanPrenom.slice(1).toLowerCase() + 
             cleanNom.charAt(0).toUpperCase() + 
             cleanNom.slice(1).toLowerCase();
  
  // Ajouter 4 chiffres aléatoires
  const digits = Math.floor(1000 + Math.random() * 9000);
  
  // Ajouter 1-2 symboles
  const symbols = ['!', '@', '#', '$', '%', '&', '*'];
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  
  return `${base}${digits}${symbol}`;
}

module.exports = { generatePassword };