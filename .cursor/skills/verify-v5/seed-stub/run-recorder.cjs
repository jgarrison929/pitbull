// Stand-in for @/server/assistant/actions `run` while deriving seeded drill-down items (see preload.cjs).
exports.run = async (user, prompt, action, input) => {
  (globalThis.__seedRuns ??= []).push({ role: user.role, action, input });
  return { ok: true };
};
