chrome.webNavigation.onCompleted.addListener(
  (details) => {
    chrome.scripting.executeScript({
      target: {
        tabId: details.tabId,
        frameIds: [details.frameId],
        allFrames: false,
      },
      files: ["./index.user.js"],
      world: "MAIN",
    });
  },
  {
    url: [
      {
        hostContains: "mydevices.stanford.edu",
      },
      {
        hostContains: "netdb.stanford.edu",
      },
      {
        hostContains: "day.stanford.edu",
        pathPrefix: "/manage/dhcplog/check_db",
      },
      {
        hostContains: "stanford.service-now.com",
      },
    ],
  }
);
