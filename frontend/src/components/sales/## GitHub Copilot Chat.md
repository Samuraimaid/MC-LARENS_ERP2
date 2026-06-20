## GitHub Copilot Chat

- Extension: 0.47.0 (prod)
- VS Code: 1.119.0 (8b640eef5a6c6089c029249d48efa5c99adf7d51)
- OS: win32 10.0.26200 x64
- GitHub Account: Samuraimaid

## Network

User Settings:
```json
  "http.systemCertificatesNode": true,
  "github.copilot.advanced.debug.useElectronFetcher": true,
  "github.copilot.advanced.debug.useNodeFetcher": false,
  "github.copilot.advanced.debug.useNodeFetchFetcher": true
```

Connecting to https://api.github.com:
- DNS ipv4 Lookup: 140.82.114.6 (20 ms)
- DNS ipv6 Lookup: Error (18 ms): getaddrinfo ENOTFOUND api.github.com
- Proxy URL: None (1 ms)
- Electron fetch (configured): timed out after 10 seconds
- Node.js https: Error (27 ms): Error: getaddrinfo ENOTFOUND api.github.com
	at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26)
- Node.js fetch: Error (12 ms): TypeError: fetch failed
	at node:internal/deps/undici/undici:14902:13
	at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
	at async n._fetch (c:\Users\DELL G5\AppData\Local\Programs\Microsoft VS Code\8b640eef5a\resources\app\extensions\copilot\dist\extension.js:5326:5229)
	at async n.fetch (c:\Users\DELL G5\AppData\Local\Programs\Microsoft VS Code\8b640eef5a\resources\app\extensions\copilot\dist\extension.js:5326:4541)
	at async u (c:\Users\DELL G5\AppData\Local\Programs\Microsoft VS Code\8b640eef5a\resources\app\extensions\copilot\dist\extension.js:5358:186)
	at async kg._executeContributedCommand (file:///c:/Users/DELL%20G5/AppData/Local/Programs/Microsoft%20VS%20Code/8b640eef5a/resources/app/out/vs/workbench/api/node/extensionHostProcess.js:503:48675)
  Error: getaddrinfo ENOTFOUND api.github.com
  	at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26)

Connecting to https://api.githubcopilot.com/_ping:
- DNS ipv4 Lookup: 140.82.114.21 (22 ms)
- DNS ipv6 Lookup: Error (36 ms): getaddrinfo ENOTFOUND api.githubcopilot.com
- Proxy URL: None (3 ms)
- Electron fetch (configured): timed out after 10 seconds
- Node.js https: Error (30 ms): Error: getaddrinfo ENOTFOUND api.githubcopilot.com
	at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26)
- Node.js fetch: Error (13 ms): TypeError: fetch failed
	at node:internal/deps/undici/undici:14902:13
	at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
	at async n._fetch (c:\Users\DELL G5\AppData\Local\Programs\Microsoft VS Code\8b640eef5a\resources\app\extensions\copilot\dist\extension.js:5326:5229)
	at async n.fetch (c:\Users\DELL G5\AppData\Local\Programs\Microsoft VS Code\8b640eef5a\resources\app\extensions\copilot\dist\extension.js:5326:4541)
	at async u (c:\Users\DELL G5\AppData\Local\Programs\Microsoft VS Code\8b640eef5a\resources\app\extensions\copilot\dist\extension.js:5358:186)
	at async kg._executeContributedCommand (file:///c:/Users/DELL%20G5/AppData/Local/Programs/Microsoft%20VS%20Code/8b640eef5a/resources/app/out/vs/workbench/api/node/extensionHostProcess.js:503:48675)
  Error: getaddrinfo ENOTFOUND api.githubcopilot.com
  	at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26)

Connecting to https://copilot-proxy.githubusercontent.com/_ping:
- DNS ipv4 Lookup: 4.228.31.153 (55 ms)
- DNS ipv6 Lookup: Error (57 ms): getaddrinfo ENOTFOUND copilot-proxy.githubusercontent.com
- Proxy URL: None (8 ms)
- Electron fetch (configured): timed out after 10 seconds
- Node.js https: Error (152 ms): Error: getaddrinfo ENOTFOUND copilot-proxy.githubusercontent.com
	at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26)
- Node.js fetch: Error (16 ms): TypeError: fetch failed
	at node:internal/deps/undici/undici:14902:13
	at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
	at async n._fetch (c:\Users\DELL G5\AppData\Local\Programs\Microsoft VS Code\8b640eef5a\resources\app\extensions\copilot\dist\extension.js:5326:5229)
	at async n.fetch (c:\Users\DELL G5\AppData\Local\Programs\Microsoft VS Code\8b640eef5a\resources\app\extensions\copilot\dist\extension.js:5326:4541)
	at async u (c:\Users\DELL G5\AppData\Local\Programs\Microsoft VS Code\8b640eef5a\resources\app\extensions\copilot\dist\extension.js:5358:186)
	at async kg._executeContributedCommand (file:///c:/Users/DELL%20G5/AppData/Local/Programs/Microsoft%20VS%20Code/8b640eef5a/resources/app/out/vs/workbench/api/node/extensionHostProcess.js:503:48675)
  Error: getaddrinfo ENOTFOUND copilot-proxy.githubusercontent.com
  	at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26)

Connecting to https://mobile.events.data.microsoft.com: 