/** Currency formatting shared by contract views. */
window.ContractFormat = {
  peso: n => '₱' + Number(n || 0).toLocaleString('en-US'),
  parsePeso: v => Number(String(v || 0).replace(/[₱,]/g, '')) || 0
};
