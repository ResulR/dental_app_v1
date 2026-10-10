/* Synthetic UX prototype; no patient data, network, persistence or credentials. */
(function (root) {
  "use strict";
  const fdi = Object.freeze([11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48]);
  const states = Object.freeze(["none", "normal", "pontic"]);
  function next(state) {
    if (!states.includes(state)) throw new TypeError("Unknown tooth state");
    return states[(states.indexOf(state) + 1) % states.length];
  }
  function change(selection, tooth) {
    if (!fdi.includes(tooth)) throw new TypeError("Invalid FDI tooth");
    const copy = { ...selection };
    const value = next(copy[tooth] || "none");
    if (value === "none") delete copy[tooth]; else copy[tooth] = value;
    return copy;
  }
  function entries(selection) {
    return fdi.filter(tooth => selection[tooth]).map(tooth => {
      if (!["normal","pontic"].includes(selection[tooth])) throw new TypeError("Invalid selection");
      return {fdi: tooth, selection: selection[tooth]};
    });
  }
  root.DentalFdi = Object.freeze({ fdi, next, change, entries });
})(globalThis);
