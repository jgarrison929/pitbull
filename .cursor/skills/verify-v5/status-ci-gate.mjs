// /status ci-gate must be exactly "pass". Presence alone (fail/pending/unknown) is not enough.
export function ciGateIsPass(ciGate) {
  return ciGate === "pass";
}
