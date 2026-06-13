# Linux Browser Control and URL Blocking Analysis

The following report evaluates technical feasibility and limitations regarding URL blocking and browser management on Linux systems.

# Current Solution

The current solution, and the one proposed by the last team working on this application, is running mitmproxy and selectively configuring browsers with CA certificates and proxy configuration. This can only be automated through policy (for certificate installs) or through forcefully digging through all certificate stores and adding the requisite certificates, which was suggested by the previous team as a next step. Enabling the proxy would either require it to be system wide, which is also invasive and can slow down traffic up to 70x, or through policy which would require a browser restart.

The only mitigation for this would be having the proxy permanently enabled as a service, which still incurs a performance hit and is not a desirable circumstance for the user.

As an application for Linux users, these do not feel like a reasonable set of requirements for a URL-blocking application. Personally, as a Linux user, I would strongly prefer a service that uses an alternative set of means which is less invasive.

# Native Extensions and Policy Implementation

Context for following options: implementation complexity varies significantly across Linux packaging formats and browser engines. No single library handles all permutations.

## Browser Policy Variations

* **Chromium Family:** Chrome, Chromium, Edge, and Brave use similar policy mechanisms but store configurations in distinct directories.
* **Firefox:** Uses a unique enterprise policy system entirely separate from Chromium-based logic.

## Packaging Format Challenges

* **Native Installs:** Browser policy locations are standardized and accessible via small per-browser resolvers.
* **Snap and Flatpak:** These sandboxed formats introduce significant inconsistency. Policy injection is difficult and requires specific adapters for each containerized environment.

# Available Implementation Options

## 1. URL Blocking Policy

This method utilizes native browser enterprise policies to restrict access. It is the simplest solution technically but lacks flexibility and requires robust policy management.

* **Requirements:** Custom policy configuration per browser and installation method (Native, Snap, Flatpak).
* **Drawbacks:** Browser restarts are required to apply policy changes.
* **Consistency:** Highly robust within the specific browser once active.

## 2. Native Extensions

Extensions represent the most robust solution if that direction is feasible. They are the industry standard for similar applications.

* **Communication:** The extension communicates by talking to the FocusBear desktop application through the native extension messaging API.
* **Requirements:** Native extensions still need to be configured per browser, but it is ostensibly simpler across different browser installation methods.
* **Monitoring:** Desktop app can check installed and enabled status through regular health checks.

## 3. Selective Proxying (system)

Proxying should be limited to browser traffic only to avoid system-wide performance degradation, but is still run while not touching browser proxy settings (system network level).

* **Mitigation:** Prevents breaking non-browser apps like Discord.
* **Operational Requirement:** The proxy must run permanently to avoid the restart requirement associated with policy-based proxy toggling.
* **Performance:** Mitmproxy is significantly slower than direct traffic, by up to 70x. This makes videos, downloads and other tasks infeasible, which is a very serious drawback for users.
* **Certificate Management Downside:** Previous implementations rely on system-wide certificate management and a background service that could leave the system in a broken state due to a botched firewall config. It is invasive, bug-prone and complex.

## Enforcement Constraints

If self-regulation is not acceptable for users, the system must enforce a list of supported browsers. This requires identifying and terminating instances of unsupported browsers where policy injection is not feasible. This process is difficult to make exhaustive due to the variety of browser forks available on Linux.

**Recommendation:** checklist of browsers for which users want to enable the FocusBear service, which will necessarily not contain all available options, and the rest are either forcefully closed during Focus Mode or left untouched, which could technically count as a risk to focus.

# Conclusion

System-wide proxying is infeasible due to severe performance degradation and systemic risk. Selective Proxying is also complex and suffers from severe performance issues. URL Blocking Policy is the simplest to implement but lacks flexibility. Given the complexity and inconsistencies across different browser engines and packaging formats (Snap/Flatpak), implementing a robust and flexible solution is difficult.

Native extensions are the most standard and offer more configuration and communication options (full browser extension capabilities), so are the recommended way to go forward.

## Next steps

We propose developing a native extension prototype for Firefox to achieve URL blocking. This prototype is expected to take some exploratory work.
