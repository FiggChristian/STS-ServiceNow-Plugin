chrome.webNavigation.onCompleted.addListener((function(e){chrome.scripting.executeScript({target:{tabId:e.tabId,allFrames:!1},files:["./index.js"]})}),{url:[{hostContains:".service-now.com",pathPrefix:"/incident.do"},{hostContains:".service-now.com",pathPrefix:"/sc_task.do"},{hostContains:".service-now.com",pathPrefix:"/ticket.do"}]});
//# sourceMappingURL=background.js.map