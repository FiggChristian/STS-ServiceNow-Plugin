chrome.webNavigation.onCompleted.addListener((details) => {
  chrome.scripting.executeScript({
    target: {
      tabId: details.tabId,
      allFrames: false,
    },
    files: ["./index.js"],
  });
}, {
  url: [
    {
      hostContains: '.service-now.com',
      pathPrefix: '/incident.do',
    },
    {
      hostContains: '.service-now.com',
      pathPrefix: '/sc_task.do',
    },
    {
      hostContains: '.service-now.com',
      pathPrefix: '/ticket.do',
    }
  ]
});
