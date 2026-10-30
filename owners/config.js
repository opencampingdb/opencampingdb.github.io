// Settings for the owner pages. Replace appKey with the key for the app
// "owner-page" from the intake's APP_KEYS secret. The key is public: it only
// identifies this page to the intake, which limits each device to 5 owner
// submissions a day.
window.OCDB_CONFIG = {
  intake: "https://ocdb-feedback-intake.scrytch.workers.dev/v1/feedback",
  appKey: "65021aab2cb8feeff70c13bbf39c4d61",
  appVersion: "owner-page-1.0.0",
};
