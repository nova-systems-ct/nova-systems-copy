# Nova Owner for iPhone and iPad

Open `NovaOwner.xcodeproj` in Xcode 26 or later and select the **NovaOwner** scheme. Use an existing Nova owner account. The app authenticates through Supabase, stores the device session in Keychain and uses the live owner-only Company HQ API for missions, assignments and private phone practice.

Company HQ shows each saved handoff, the platform drafts and Zion’s script. On supported devices with Apple Intelligence enabled, each role can create a proposal in its own on-device model session. The Apple model is shared across those sessions. The Wallet tab opens the existing signed setup pass through PassKit.

## Build and device check

```sh
xcodebuild -project ios/NovaOwner.xcodeproj -scheme NovaOwner \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

Select Nova Systems’ existing Apple Developer team in Signing & Capabilities to run on an iPhone. Confirm the bundle ID `app.nova-systems.owner` is available for that team, or use the bundle ID already assigned to the matching App Store Connect app record. On the phone, verify login, reopening a saved mission, starting and resuming a test mission, assignment changes, phone practice and adding the test pass in Wallet.

## App Store Connect

Archive a Release build signed by the Apple Developer team, then use Xcode Organizer to validate and upload it. Add the app metadata, screenshots, and privacy details in App Store Connect. Provide review access through an isolated review environment with demo data. The production owner workspace contains private company records. Choose the distribution method in App Store Connect before the first approval.

- [Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/)
- [Provide information for a complete review](https://developer.apple.com/help/app-review/before-submitting-for-review/complete-review/)
- [Set distribution methods](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/set-distribution-methods)
