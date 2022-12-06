import { withReplacementDelimiters } from "../helpers";
import { AssignmentGroup, Macro, TicketState } from "./types";

export const macros: Macro[] = [
  {
    name: "Request MAC Address",
    description:
      "Ask user to provide the MAC address for the device in question.",
    fields: {
      additional_comments: `
        Hi ${withReplacementDelimiters("ticket.requester.first_name")},

        Could you please provide the hardware address (also known as a MAC address) for this device? Here are instructions on how to find it: ${withReplacementDelimiters(
          "link.mac_address"
        )}.

        With this information we'll be able to look into your issue further.

        ${withReplacementDelimiters("current_user.signature")}
      `,
      state: TicketState.Pending,
    },
  },
  {
    name: "Wireless Trouble",
    description: "Gives the user instructions for troubleshooting Wi-Fi.",
    fields: {
      additional_comments: `
        Hi ${withReplacementDelimiters("ticket.requester.first_name")},

        Thank you for reporting your trouble with the wireless network connectivity on the Stanford campus. There are some easy steps to take that resolve wireless network issues for most registered devices on campus:

        1. Ensure you have the private address feature disabled on your device. You can find instructions for doing this here: ${withReplacementDelimiters(
          "link.disable_private_address"
        )}.
        2. Forget/remove "Stanford Visitor" and "eduroam" wireless networks from your device. Connect only to the "Stanford" wireless network. You can find instructions for forgetting a Wi-Fi network here: [Mac](${withReplacementDelimiters(
          "link.forget_wifi.mac"
        )}) | [Windows](${withReplacementDelimiters(
        "link.forget_wifi.windows"
      )}) | [iOS](${withReplacementDelimiters(
        "link.forget_wifi.ios"
      )}) | [Android](${withReplacementDelimiters("link.forget_wifi.android")})
        3. Toggle the Wi-Fi on your device off and back on again.
        4. Completely power down and restart your computer or device.

        In the event that these steps don't resolve your wireless trouble, please find your device's MAC address and send it to us so we may begin troubleshooting for you.  Please see the following resource for additional information about finding your MAC address: ${withReplacementDelimiters(
          "link.mac_address"
        )}.

        Again, we will require the MAC address of the device that you would like assistance with in order to help you. Thank you for your patience and cooperation.

        ${withReplacementDelimiters("current_user.signature")}
      `,
      state: TicketState.Pending,
    },
  },
  {
    name: "Resolve Ticket",
    description:
      "Sends a closing comment to the customer and resolves the ticket.",
    fields: {
      close_notes: `
        Hi ${withReplacementDelimiters("ticket.requester.first_name")},

        Thank you for letting us know your issue has been resolved. Feel free to reach out again if you run into any issues in the future!

        ${withReplacementDelimiters("current_user.signature")}
      `,
      assignment_group: AssignmentGroup.Escalation,
      state: TicketState.Resolved,
      assigned_to: withReplacementDelimiters("current_user.full_name"),
    },
  },
  {
    name: "Check In #1",
    description: "Asks the user for an update after not answering.",
    fields: {
      additional_comments: `
        Hi ${withReplacementDelimiters("ticket.requester.first_name")},

        Just wanted to check in and see if you were able to solve your issue or if you required further assistance? Please let us know so we can close this ticket or continue troubleshooting if necessary. 

        ${withReplacementDelimiters("current_user.signature")}
      `,
      state: TicketState.Pending,
    },
  },
  {
    name: "Check In #2",
    description:
      "Asks the user for an update again if they didn't answer Check In #1.",
    fields: {
      additional_comments: `
        Hi ${withReplacementDelimiters("ticket.requester.first_name")},

        This is our second attempt to reach out in regards to your issue. Please let us know if your issue has been resolved or if you're still experiencing problems. If so, we can continue to troubleshoot. Otherwise, we can go ahead and close this ticket for now.

        ${withReplacementDelimiters("current_user.signature")}
      `,
      state: TicketState.Pending,
    },
  },
  {
    name: "Close Stale Ticket",
    description: "Send a closing note to the customer and resolves the ticket.",
    fields: {
      work_notes: `
        No follow up after a while. Closing ticket.
      `,
      close_notes: `
        Hi ${withReplacementDelimiters("ticket.requester.first_name")},

        We haven't heard back in a while, so we'll go ahead and close your ticket now. Please feel free to reach out to us if you run into any more issues in the future.

        ${withReplacementDelimiters("current_user.signature")}
      `,
      assignment_group: AssignmentGroup.Escalation,
      state: TicketState.Resolved,
      assigned_to: withReplacementDelimiters("current_user.full_name"),
    },
  },
  {
    name: "Time Stamps",
    description:
      "Request timestamps from the customer for a Net Trouble report.",
    fields: {
      additional_comments: `
        Hi ${withReplacementDelimiters("ticket.requester.first_name")},

        If you are still experiencing connection issues, could you please send us three times and dates of exactly when you’ve had trouble, each with a brief description of your activity at the time and how it behaved in a way that was less than desirable? For example:
        
        > ${withReplacementDelimiters(
          "info.current_date"
        )} at ${withReplacementDelimiters(
        "info.current_time"
      )} – Dropped a Zoom Meeting

        Three timestamps in that format should be enough for us to submit a report to the networking team to have them take a look at your device's connection history and figure out what's going on.

        Thank you so much for your continued patience and cooperation while we work to resolve the issue.

        ${withReplacementDelimiters("current_user.signature")}
      `,
      state: TicketState.Pending,
    },
  },
  {
    name: "Net Trouble Report",
    description: "Shows the form for submitting a the Net Trouble report.",
    fields: {
      work_notes: `
        ### Network Trouble Report

        MAC address: ${withReplacementDelimiters("cursor")}
        Operating system: ${withReplacementDelimiters("cursor")}
        Building & room number: ${withReplacementDelimiters("cursor")}
        NetDB node state: ${withReplacementDelimiters("cursor:Good")}
        1st timestamp: ${withReplacementDelimiters("cursor")}
        2nd timestamp: ${withReplacementDelimiters("cursor")}
        3rd timestamp: ${withReplacementDelimiters("cursor")}
        Building and room number: ${withReplacementDelimiters("cursor")}
        Nature of issue: ${withReplacementDelimiters(
          "cursor:'<!-- e.g., slow, trouble connecting, dropped sessions, poor coverage -->'"
        )}
        Specific issue details: ${withReplacementDelimiters("cursor")}
        Troubleshooting attempted thus far: ${withReplacementDelimiters(
          "cursor"
        )}

        <!-- Copy and paste as needed for multiple devices -->
      `,
      assignment_group: AssignmentGroup.ResNet,
      state: TicketState.Active,
    },
  },
  {
    name: "TSO Activation Form",
    description: "Shows the form for submitting a TSO activation request.",
    fields: {
      work_notes: `
          Hi ITOC,

          Could you please schedule an onsite appointment for UIT I&M to repair this TSO in a student residence, and then pass this ticket onto them? Thank you!

          <!-- All fields are required to be completed with actionable data. -->

          Destination: UIT Installation and Maintenance
          Bill to PTA: 1181807-6-AABVT
          Building and Room: ${withReplacementDelimiters("cursor")}
          TSO number: ${withReplacementDelimiters("cursor")}
          Is this a primary or additional TSO: ${withReplacementDelimiters(
            "cursor"
          )}
          Customer phone: ${withReplacementDelimiters(
            `cursor:"${withReplacementDelimiters("ticket.requester.number")}"`
          )}
          Customer email: ${withReplacementDelimiters(
            `cursor:"${withReplacementDelimiters("ticket.requester.email")}"`
          )}
          Customer affiliation: ${withReplacementDelimiters("cursor:Student")}
          Ethernet MAC address of device: ${withReplacementDelimiters("cursor")}
          NetDB status: ${withReplacementDelimiters("cursor:Good")}
          NetDB date last changed: ${withReplacementDelimiters("cursor")}
          NetDB date registered: ${withReplacementDelimiters("cursor")}
          DHCPlog recent history: ${withReplacementDelimiters("cursor")}
      `,
      assignment_group: AssignmentGroup.ITOC,
      state: TicketState.Active,
    },
  },
  {
    name: "Register via IPRequest",
    description:
      "Gives the user step-by-step instructions for registering a device through IPRequest.",
    fields: {
      additional_comments: `
        Hi ${withReplacementDelimiters("ticket.requester.first_name")},

        To register your device, you can follow these steps:

        1. You'll need to find the device's hardware address (also called its MAC address). Here are instructions for how to do so: ${withReplacementDelimiters(
          "link.mac_address"
        )}.
        2. Once you've found the MAC address for your device, go to ${withReplacementDelimiters(
          "link.iprequest"
        )} on your computer (make sure the computer is already connected to the Stanford network or Stanford's VPN, as the website will not load otherwise).
        3. Fill out the short questionnaire and continue to your registrations.
        4. Click the **New Registration** button at the bottom.
        5. Continue through the terms and conditions until it asks whether the computer you are currently staring at is the one you want to register. Select **No**.
        6. From the Device Type list, choose your device, or **Other** if it is not listed.
        7. For the Operating System, choose **Other (Wired)** if you plan on connecting your device via an ethernet cable, or **Other (Gaming)** if you plan on connecting it via Wi-Fi (even if your device is not going to be used for gaming).
        8. Under Hardware Address, copy and paste the MAC address you found in Step 1.
        9. Continue through the registration, filling out any details it asks for.
        10. Once registered, your device should be able to connect to the internet within about 20 minutes. It's best to unplug it for about two minutes and plug it back in to give it the best chance of seeing the new changes on the system.

        Please let us know if you have any questions or issues.
        
        ${withReplacementDelimiters("current_user.signature")}}
      `,
      state: TicketState.Pending,
    },
  },
  {
    name: "Register Router",
    description:
      "Gives the user step-by-step instructions for setting up a router.",
    fields: {
      additional_comments: `
        Hi ${withReplacementDelimiters("ticket.requester.first_name")},

        Please follow the steps below for setting up your own router:

        1. Purchase a router. Most major router brands (e.g. TP-Link, NETGEAR, ASUS, Linksys, Google, etc.) should do, so feel free to choose one that best suits your needs and price point.
        2. Once you have the router, look for its MAC address, which is usually printed on the side. It should be 12 alphanumeric digits in the form of \`A1:B2:C3:D4:E5:F6\`.
        3. Once you've found the MAC address, go to ${withReplacementDelimiters(
          "link.iprequest"
        )} on your computer (make sure the computer you're using is connected to the Stanford network, **not** the router's network).
        4. Fill out the short questionnaire and continue to your registrations.
        5. Click the **New Registration** button at the bottom.
        6. Continue through the terms and conditions until it asks whether the computer you are currently staring at is the one you want to register. Select **No**.
        7. From the Device Type list, choose **Other** if it is not listed.
        8. For the Operating System, choose **Other (Wired)**.
        9. Under Hardware Address, copy and paste the MAC address you found in Step 2.
        9. Continue through the registration, filling out any details it asks for.
        10. Once registered, please unplug the router for at least two minutes, as routers tend to not want to update their settings unless they remain unplugged for a bit of time. After 20 or so minutes, your router should be able to connect to the internet, allowing you to connect other devices to the router's network.

        Please let us know if you have any questions or issues.

        ${withReplacementDelimiters("current_user.signature")}
      `,
      state: TicketState.Pending,
    },
  },
  {
    name: "Upgrade to Windows 10 Education",
    description:
      "Gives the user step-by-step instructions for upgrading to Windows 10 Education.",
    fields: {
      additional_comments: `
        Hi ${withReplacementDelimiters("ticket.requester.first_name")},

        You can upgrade your version of Windows 10 to Windows 10 Education (which is compatible with Stanford's encryption software and BitLocker) by following these steps:

        1. Go to [Stanford's Software Licensing Webstore](https://stanford.onthehub.com/WebStore/OfferingDetails.aspx?o=bb702eb6-cbf8-e811-810d-000d3af41938) to get your free product key of Windows 10 Education (one per student).
        2. Right click the **Start Menu** from your desktop.
        3. Select **System**.
        4. Click **Change product key**.
        5. Copy & paste the 25-digit license key from step 1.
        6. Allow the system to reboot (may take 5–10 minutes).

        Hope this helps. Lets us know if you have any questions or issues.

        ${withReplacementDelimiters("current_user.signature")}
      `,
      state: TicketState.Pending,
    },
  },
  {
    name: "Excessive DNS Check In",
    description:
      "Asks the user about excessive DNS queries being generated by their devices.",
    fields: {
      additional_comments: `
        Hi ${withReplacementDelimiters("ticket.requester.first_name")},

        UIT has informed us that one of your devices ${withReplacementDelimiters(
          `cursor:"<!-- optionally provide more information like the MAC address here  -->"`
        )} has been generating excessive DNS queries. Would you happen to have any idea why that might be happening? This can usually be caused by doing something out of the ordinary like running a server on the computer, downloading a large data set, etc. Using your computer as normal for tasks like Zoom, browsing the internet, etc. generally shouldn't have any issues. If you are aware of your computer recently doing anything out of the ordinary, please let us know so we know that this was a one-time occurrence. Otherwise, we can go ahead and make a small change on our end to make sure this issue is resolved in the future (and this shouldn't have any noticeable effect on your computer), but we just wanted to reach out to let you know and inquire as to whether you know of why that might be happening before making that change.

        Please let us know if you have questions or issues. 

        ${withReplacementDelimiters("current_user.signature")}
      `,
      state: TicketState.Pending,
    },
  },
  {
    name: "2.4 GHz-Only Devices",
    description:
      "Explains what to do for devices that only work on 2.4 a GHz band.",
    fields: {
      additional_comments: `
        Hi ${withReplacementDelimiters("ticket.requester.first_name")},

        It looks like that the kind of device you want to use only works on a 2.4 GHz band, which Stanford's network is not currently set up to provide in the way at-home Wi-Fi routers do. You can read more about unsupported devices here: https://stanford.service-now.com/student_services?id=kb_article&sys_id=fb9174068746f850d9e07778cebb35d1.

        While your device won't be able to connect to Stanford's network, you have two options:

        1. Buy another device that does work with both 2.4 GHz and 5 GHz bands (which may or may not exist since many devices, especially "smart home" devices, are made for exactly that: homes with a private Wi-Fi network, not campuses with enterprise-grade Wi-Fi networks). If buying online such as from Amazon, make sure to look at comments and reviews to verify that the device does in fact work on both 2.4 GHz and 5 GHz bands.
        2. Set up your own router. You can purchase your own router and get it connected to the Stanford network, and the router should be able to broadcast both 2.4 GHz and 5 GHz bands correctly for the device to connect to. We can guide you through the process of setting up your router if you choose to go this route.

        Please let us know if you have questions or issues.
        
        ${withReplacementDelimiters("current_user.signature")}
      `,
      state: TicketState.Pending,
    },
  },
];
