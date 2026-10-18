# Sprint 1 demo

## Goal

Show that the mobile starter gives the team working, independent preview flows
for login, settings, and component work. This should lay the foundation for future development, features, and workflows.

## Demo Checklist

- [ ] Login/Logout using test account credentials is operational and follows expected app flow (login success/failure is implemented)
- [ ] Homepage requires logging in to access
- [ ] Accessibility settings are in every prop and screen (accessibiilty labels, states, etc.)
- [ ] Size/colour/motion changes are implemented properly
- [ ] Size/colour/motion settings saved during the demo are loaded on next launch (preference retention)
- [ ] Basic functionality for accessibility features, including VoiceOver, text size changes, and usability all are implemented and work as intended
- [ ] Login service works behind the agreed AuthService interface
- [ ] Empty login fields show useful errors (when pressing log in using blank credentials)
- [ ] Repeated taps while trying to sign in with credentials does not submit more than once (no response spamming)
- [ ] Normal, busy, and disabled buttons all look different and the disabled/busy buttons do nothing
- [ ] Email field has the email specific keyboard
- [ ] Password masking is implemented into the login field
- [ ] Settings controls announce their label and selected state to a screen reader (IMPORTANT!)

## Demo success criteria

- **No actual credential setups with supabase or environment variables are used in the demo**
- Type checking and the fake-auth tests pass.
- Each preview route opens independently.
- All features are examined and pass both basic and accessibility tests (voiceovers, text size changes, usability)