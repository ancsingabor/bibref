const messages = {
  select_language: ['Válasszon nyelvet. / Select a language.', 'Válasszon nyelvet. / Select a language.'],
  unavailable: ['A kérdés-válasz szolgáltatás jelenleg nem érhető el.', 'Q&A is currently unavailable.'],
  unsupported: ['A rendelkezésre álló források nem támasztanak alá választ.', 'The available sources do not support an answer.'],
  partial: ['A források a kérdésnek csak egy részére adnak választ.', 'The sources support an answer to only part of the question.'],
  invalid_input: ['Érvénytelen kérés.', 'Invalid request.'],
  invalid_origin: ['A kérés eredete nem engedélyezett.', 'The request origin is not allowed.'],
  not_found: ['A kérés nem található.', 'Request not found.'],
  request_conflict: ['A kérés adatai megváltoztak.', 'The request details changed.'],
  request_expired: ['A kérés lejárt.', 'The request expired.'],
  daily_limit: ['A böngésző elérte a napi három válaszos korlátot.', 'This browser reached its daily limit of three answers.'],
  network_limit: ['Túl sok kérés érkezett erről a hálózatról.', 'Too many requests from this network.'],
  capacity: ['A szolgáltatás foglalt.', 'The service is busy.'],
  budget: ['A közös havi keret elfogyott.', 'The shared monthly budget has been reached.'],
  uncertain: ['A kérés eredménye még nem ismert.', 'The request outcome is still unknown.'],
  provider_failure: ['A válasz ellenőrzése nem sikerült.', 'The answer could not be verified.'],
};

export const labels = Object.freeze({
  hu: Object.freeze({ objection: 'Ellenvetés', sed_contra: 'Ezzel szemben', respondeo: 'Aquinói Tamás fő válasza', reply: 'Aquinói Tamás válasza az ellenvetésre', synthesis: 'Összegzés', generated_translation: 'Generált fordítás' }),
  en: Object.freeze({ objection: 'Objection', sed_contra: 'On the contrary', respondeo: 'Aquinas’s main answer', reply: 'Aquinas’s reply to the objection', synthesis: 'Synthesis', generated_translation: 'Generated translation' }),
});
export const validLanguage = language => language === 'hu' || language === 'en';
export const message = (code, language) => (Object.hasOwn(messages, code) ? messages[code] : messages.unavailable)[language === 'hu' ? 0 : 1];
export const localizedError = (code, language) => validLanguage(language)
  ? { code, language, message: message(code, language) }
  : { code: 'select_language', language: null, message: message('select_language') };
