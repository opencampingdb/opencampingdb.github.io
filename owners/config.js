// Settings for the owner pages. Replace appKey with the key for the app
// "owner-page" from the intake's APP_KEYS secret. The key is public: it only
// identifies this page to the intake, which limits each device to 5 owner
// submissions a day.
window.OCDB_CONFIG = {
  intake: "https://ocdb-feedback-intake.scrytch.workers.dev/v1/feedback",
  appKey: "REPLACE_WITH_OWNER_PAGE_APP_KEY",
  appVersion: "owner-page-1.0.0",
};
