import baseConfig from './playwright.config';

// Config dedicada de la utility de capturas (US19, FR-1509/FR-1502; S2-6):
// hereda la base (reset de BD, webServer con readiness en backend+web, video,
// screenshot, trace, reporter) y desexcluye el spec de capturas que la suite
// por defecto ignora (testIgnore). Corre con
// `VISUAL_CAPTURES=antes|despues pnpm test:visual`.
export default { ...baseConfig, testIgnore: [], testMatch: /visual-captures/ };
