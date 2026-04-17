### Manual Configuration & User Burden

A primary drawback of the current architecture is the high degree of manual intervention required from the user. Because automated injection is unreliable across diverse Linux environments, the setup process currently mandates several manual steps that create a high barrier to entry:

* **Manual Certificate Import:** Users must navigate through deep browser security menus (e.g., `Settings -> Privacy & Security -> Certificates -> View Certificates`) to manually import the mitmproxy CA. This includes the friction of trusting a root CA, which often triggers intimidating security warnings from the browser.
* **Proxy Entry:** Users are required to manually toggle their browser’s network settings to point to `localhost:8080` (or whichever port the service occupies). This is a tedious process that most users expect to be handled "under the hood."
* **Sandboxing Conflicts:** For users running browsers as **Flatpaks** or **Snaps**, manual configuration is even more complex due to filesystem isolation, often requiring additional permissions overrides (via Flatseal or CLI) just to allow the browser to see the local proxy or certificate files.

This manual "onboarding" is not only a poor user experience but also a significant point of failure for non-technical users who may find the process daunting or error-prone.

---

### Technical Overview
The implementation utilizes **mitmproxy** to intercept and filter web traffic. For this to function, the following conditions must be met:
1.  **Certificate Trust:** A custom CA certificate must be installed and trusted by the operating system and/or specific browser certificate stores (e.g., NSS).
2.  **Proxy Configuration:** Browsers must be configured to route traffic through the local `mitmproxy` instance.

### Challenges & Limitations

#### 1. Automation Complexity
Automating these steps on Linux is notoriously difficult due to the fragmentation of certificate stores.
* **System vs. Browser Stores:** Many browsers (like Firefox) use their own internal NSS database rather than the system-wide store.
* **The "Brute Force" Method:** Previous suggestions included programmatically digging through every possible certificate store to inject the CA. This is fragile and poses security risks.
* **Policy Constraints:** While browser policies can automate certificate installs, they generally require a **browser restart** to take effect, disrupting the user’s workflow.

#### 2. Performance Degradation
The performance overhead of routing all web traffic through a local proxy is substantial. 
* **Latency:** In testing, system-wide proxying has shown potential traffic slowdowns of **up to 70x**. 
* **Resource Usage:** Maintaining an active proxy service permanently incurs a constant CPU and memory footprint, which is undesirable for a productivity-focused application.

#### 3. User Experience & Invasiveness
For the Linux community, transparency and system integrity are paramount.
* **Invasiveness:** Forcing a system-wide proxy is a heavy-handed approach for a URL-blocking feature.
* **User Friction:** Requiring users to trust a custom root CA and endure significant network latency does not align with the goal of a lightweight, efficient Linux application.

---

### Future Direction
To achieve feature parity with other Focus Bear platforms without compromising system performance, we are evaluating less invasive alternatives:

* **Native Messaging:** Using a lightweight browser extension that communicates directly with the Linux binary to block URLs at the application layer.
* **Browser URL Blocking:** Browsers have a built-in policy that blocks certain URLs, but requires policy management across different browsers & installations, and requires a browser restart.

As a Linux-first application, the priority is to move away from the `mitmproxy` model in favor of a solution that respects system resources and user privacy.
