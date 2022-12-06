import { dedent } from "../helpers/dedent";
import { TicketType, getTicketType } from "../helpers";
import { Namespace, NOWType, Replacement, Trigger } from "./types";

export const namespaces: Namespace[] = [
  {
    name: "Links",
    insert: "link.",
    icon: "link",
  },
  {
    name: "Ticket Information",
    insert: "ticket.",
    icon: "list",
  },
  {
    name: "Current User",
    insert: "current_user.",
    icon: "user",
  },
  {
    name: "Phone Numbers",
    insert: "phone_number.",
    icon: "phone",
  },
  {
    name: "Additional Information",
    insert: "info.",
    icon: "info",
  },
  {
    name: "Icons",
    insert: "icon.",
    icon: "image",
  },
];

export const replacements: Replacement[] = [
  {
    triggers: ["ticket.requester.first_name", "ticket.requester.name.first"],
    exec: () => {
      const input = {
        [TicketType.Incident]: document.getElementById(
          "sys_display.incident.u_requested_for"
        ),
        [TicketType.SupportRequest]: document.getElementById(
          "sys_display.ticket.u_requested_for"
        ),
        [TicketType.Task]: document.getElementById(
          "sc_task.request_item.u_requested_for_label"
        ),
      }[getTicketType()] as HTMLInputElement | null;
      if (input) {
        const index = input.value.indexOf(" ");
        return ~index ? input.value.substring(0, index) : input.value;
      }
      return null;
    },
    description: "The requester's first name",
  },
  {
    triggers: ["ticket.requester.last_name", "ticket.requester.name.last"],
    exec: () => {
      const input = {
        [TicketType.Incident]: document.getElementById(
          "sys_display.incident.u_requested_for"
        ),
        [TicketType.SupportRequest]: document.getElementById(
          "sys_display.ticket.u_requested_for"
        ),
        [TicketType.Task]: document.getElementById(
          "sc_task.request_item.requested_for_label"
        ),
      }[getTicketType()] as HTMLInputElement | null;
      if (input) {
        const index = input.value.indexOf(" ");
        return ~index ? input.value.substring(index + 1).trimStart() : null;
      }
      return null;
    },
    description: "The requester's last name",
  },
  {
    triggers: ["ticket.requester.name", "ticket.requester.name.full"],
    exec: () => {
      const input = {
        [TicketType.Incident]: document.getElementById(
          "sys_display.incident.u_requested_for"
        ),
        [TicketType.SupportRequest]: document.getElementById(
          "sys_display.ticket.u_requested_for"
        ),
        [TicketType.Task]: document.getElementById(
          "sc_task.request_item.requested_for_label"
        ),
      }[getTicketType()] as HTMLInputElement | null;
      return input ? input.value : null;
    },
    description: "The requester's full name",
  },
  {
    triggers: ["ticket.requester.email"],
    exec: () => {
      const input = {
        [TicketType.Incident]: document.getElementById(
          "incident.u_guest_email"
        ),
        [TicketType.SupportRequest]: document.getElementById(
          "ticket.u_guest_email"
        ),
        [TicketType.Task]: document.getElementById(
          "sys_readonly.sc_task.request_item.u_email"
        ),
      }[getTicketType()] as HTMLInputElement | null;
      if (input) {
        return input.value;
      }
      return null;
    },
    description: "The requester's email address",
  },
  {
    triggers: [
      "ticket.requester.number",
      "ticket.requester.phone",
      "ticket.requester.phone_number",
    ],
    exec: () => {
      const input = {
        [TicketType.Incident]: document.getElementById(
          "incident.u_phone_number"
        ),
        [TicketType.SupportRequest]: document.getElementById(
          "ticket.u_phone_number"
        ),
        [TicketType.Task]: document.getElementById(
          "sys_readonly.sc_task.request_item.u_phone_number"
        ),
      }[getTicketType()] as HTMLInputElement | null;
      if (input) {
        const number = input.value.replace(/\D/g, "");
        if (number.length === 10) {
          return `(${number.substring(0, 3)}) ${number.substring(
            3,
            6
          )}-${number.substring(6, 10)}`;
        } else {
          return input.value;
        }
      }
      return null;
    },
    description: "The requester's phone number",
  },
  {
    triggers: ["ticket.number", "ticket.id"],
    exec: () => {
      const input = {
        [TicketType.Incident]: document.getElementById(
          "sys_readonly.incident.number"
        ),
        [TicketType.SupportRequest]: document.getElementById(
          "sys_readonly.ticket.number"
        ),
        [TicketType.Task]: document.getElementById(
          "sys_readonly.sc_task.number"
        ),
      }[getTicketType()] as HTMLInputElement | null;
      if (input) {
        return input.value;
      }
      return null;
    },
    description: "The ticket's number",
  },
  {
    triggers: [
      "ticket.title",
      "ticket.name",
      "ticket.description",
      "ticket.short_description",
    ],
    exec: () => {
      const input = {
        [TicketType.Incident]: document.getElementById(
          "incident.short_description"
        ),
        [TicketType.SupportRequest]: document.getElementById(
          "ticket.short_description"
        ),
        [TicketType.Task]: document.getElementById("sc_task.short_description"),
      }[getTicketType()] as HTMLInputElement | null;
      if (input) {
        return input.value;
      }
      return null;
    },
    description: "The ticket's title",
  },
  {
    triggers: ["current_user.first_name", "current_user.name.first"],
    exec: () => {
      const NOW = (window as { NOW?: NOWType }).NOW;
      let name = NOW?.user?.firstName || null;
      if (typeof name === "string") {
        return name;
      }
      name = NOW?.user_display_name || null;
      if (!name) {
        const elem = document.querySelector("[id*='add_me'][data-user]");
        if (elem) {
          name = elem.getAttribute("data-user");
        }
      }
      if (typeof name === "string") {
        const index = name.indexOf(" ");
        return ~index ? name.substring(0, index).trimStart() : name;
      }
      return null;
    },
    description: "Your first name",
  },
  {
    triggers: ["current_user.last_name", "current_user.name.last"],
    exec: () => {
      const NOW = (window as { NOW?: NOWType }).NOW;
      let name = NOW?.user?.lastName || null;
      if (typeof name === "string") {
        return name;
      }
      name = NOW?.user_display_name || null;
      if (!name) {
        const elem = document.querySelector("[id*='add_me'][data-user]");
        if (elem) {
          name = elem.getAttribute("data-user");
        }
      }
      if (typeof name === "string") {
        const index = name.indexOf(" ");
        return ~index ? name.substring(index + 1).trimStart() : name;
      }
      return null;
    },
    description: "Your last name",
  },
  {
    triggers: [
      "current_user.name.full",
      "current_user.full_name",
      "current_user.name",
    ],
    exec: () => {
      const NOW = (window as { NOW?: NOWType }).NOW;
      let name = NOW?.user_display_name || null;
      if (typeof name === "string") {
        return name;
      }
      name = NOW?.user?.firstName || null;
      if (name) {
        const last = NOW?.user?.lastName || null;
        if (last) return `${name} ${last}`;
        else name = null;
      }
      if (!name) {
        const elem = document.querySelector("[id*='add_me'][data-user]");
        if (elem) {
          name = elem.getAttribute("data-user");
        }
      }

      return typeof name === "string" ? name : null;
    },
    description: "Your full name",
  },
  {
    triggers: ["info.current_date", "info.today"],
    exec: () => {
      const now = new Date();
      const month = now.getMonth() + 1 + "";
      const day = now.getDate() + "";
      const year = now.getFullYear() + "";
      return `${("00" + month).substring(month.length)}/${(
        "00" + day
      ).substring(day.length)}/${year}`;
    },
    description: "Today's date as MM/DD/YYYY",
  },
  {
    triggers: ["info.current_time"],
    exec: () => {
      const now = new Date();
      const hour = now.getHours();
      const min = now.getMinutes();
      return `${hour <= 12 ? hour || 12 : hour - 12}:${("00" + min).substring(
        min.toString().length
      )} ${hour < 12 ? "AM" : "PM"}`;
    },
    description: "The current time as HH:MM AM/PM",
  },
  {
    triggers: ["link.mac_address", "link.macaddress", "link.mac"],
    value: `https://stanford.service-now.com/student_services?id=kb_article&number=KB00018475\n`,
    description: "Link for finding MAC addresses",
  },
  {
    triggers: ["link.mydevices", "link.my_devices"],
    value: `https://mydevices.stanford.edu`,
    description: "Link to MyDevices page",
  },
  {
    triggers: ["link.iprequest"],
    value: `https://iprequest.stanford.edu`,
    description: "Link to IPRequest page",
  },
  {
    triggers: ["link.snsr"],
    value: `https://snsr.stanford.edu`,
    description: "Link to SNSR download page",
  },
  {
    triggers: ["link.mdm"],
    value: `https://uit.stanford.edu/service/mobiledevice/management`,
    description: "Link to MDM page for all devices",
  },
  {
    triggers: ["link.mdm.ios", "link.mdm.iphone"],
    value: `https://uit.stanford.edu/service/mobiledevice/management/enroll_ios`,
    description: "Link to MDM page for iOS devices",
  },
  {
    triggers: ["link.mdm.android"],
    value: `https://uit.stanford.edu/service/mobiledevice/management/enroll_android`,
    description: "Link to MDM page for Android devices",
  },
  {
    triggers: ["link.swde"],
    value: `https://uit.stanford.edu/service/encryption/wholedisk`,
    description: "Link to SWDE page for all devices",
  },
  {
    triggers: [
      "link.swde.mac",
      "link.swde.macbook",
      "link.swde.macos",
      "link.swde.osx",
    ],
    value: `https://uit.stanford.edu/service/encryption/wholedisk/install_mac`,
    description: "Link to SWDE page for MacBooks",
  },
  {
    triggers: ["link.swde.windows", "link.swde.pc"],
    value: `https://uit.stanford.edu/service/encryption/wholedisk/install_windows`,
    description: "Link to SWDE page for Windows PCs",
  },
  {
    triggers: ["link.bigfix", "link.big_fix"],
    value: `https://uit.stanford.edu/software/bigfix`,
    description: "Link to BigFix page for all devices",
  },
  {
    triggers: ["link.vpn"],
    value: `https://uit.stanford.edu/service/vpn`,
    description: "Link to Stanford VPN page for all devices",
  },
  {
    triggers: [
      "link.vpn.mac",
      "link.vpn.macbook",
      "link.vpn.macos",
      "link.vpn.osx",
    ],
    value: `https://web.stanford.edu/dept/its/support/vpn/installers/InstallAnyConnect.pkg`,
    description: "Link to download VPN for MacBooks",
  },
  {
    triggers: ["link.vpn.windows", "link.vpn.pc"],
    value: `https://web.stanford.edu/dept/its/support/vpn/installers/InstallAnyConnect.exe`,
    description: "Link to download VPN for Windows PCs",
  },
  {
    triggers: ["link.vlre"],
    value: `https://uit.stanford.edu/service/vlre`,
    description: "Link to download VLRE for all devices",
  },
  {
    triggers: [
      "link.vlre.mac",
      "link.vlre.macbook",
      "link.vlre.macos",
      "link.vlre.osx",
    ],
    value: `https://uit.stanford.edu/service/vlre/mac`,
    description: "Link to download VLRE for MacBooks",
  },
  {
    triggers: ["link.vlre.windows", "link.vlre.pc"],
    value: `https://uit.stanford.edu/service/vlre/windows`,
    description: "Link to download VLRE for Windows PCs",
  },
  {
    triggers: ["link.cardinal_key", "link.cardinalkey"],
    value: `https://uit.stanford.edu/service/cardinalkey/installation`,
    description: "Link to download Cardinal Key for all devices",
  },
  {
    triggers: [
      "link.cardinal_key.mac",
      "link.cardinal_key.macbook",
      "link.cardinal_key.macos",
      "link.cardinal_key.osx",
      "link.cardinalkey.mac",
      "link.cardinalkey.macbook",
      "link.cardinalkey.macos",
      "link.cardinalkey.osx",
    ],
    value: `https://uit.stanford.edu/service/cardinalkey/installation#macos`,
    description: "Link to download Cardinal Key for MacBooks",
  },
  {
    triggers: [
      "link.cardinal_key.windows",
      "link.cardinal_key.pc",
      "link.cardinalkey.windows",
      "link.cardinalkey.pc",
    ],
    value: `https://uit.stanford.edu/service/cardinalkey/installation##windows`,
    description: "Link to download Cardinal Key for Windows PCs",
  },
  {
    triggers: ["link.cardinal_key.ios", "link.cardinal_key.iphone"],
    value: `https://uit.stanford.edu/service/cardinalkey/install_ios`,
    description: "Link to download Cardinal Key for iPhones/iPads",
  },
  {
    triggers: ["link.ssrt"],
    value: `https://uit.stanford.edu/software/ssrt`,
    description: "Link to download SSRT for all devices",
  },
  {
    triggers: [
      "link.ssrt.mac",
      "link.ssrt.macbook",
      "link.ssrt.macos",
      "link.ssrt.osx",
    ],
    value: `https://web.stanford.edu/dept/its/support/ess/mac/unrestricted/SSRT.pkg`,
    description: "Link to download SSRT for MacBooks",
  },
  {
    triggers: ["link.ssrt.windows", "link.ssrt.pc"],
    value: `https://web.stanford.edu/dept/its/support/ess/pc/unrestricted/RunSSRT.exe`,
    description: "Link to download SSRT for Windows PCs",
  },
  {
    triggers: ["link.appointment", "link.book_appointment"],
    value: `https://bit.ly/bookPTSappt`,
    description: "Link to book appointments with PTS",
  },
  {
    triggers: [
      "link.forget_wifi.mac",
      "link.forget_wifi.macbook",
      "link.forget_wifi.macos",
      "link.forget_wifi.osx",
    ],
    value: `https://stanford.service-now.com/student_services?id=kb_article&number=KB00018430`,
    description:
      "Link to instructions for forgetting Wi-Fi networks on MacBooks",
  },
  {
    triggers: ["link.forget_wifi.windows", "link.forget_wifi.pc"],
    value: `https://stanford.service-now.com/student_services?id=kb_article&number=KB00018429`,
    description:
      "Link to instructions for forgetting Wi-Fi networks on Windows PCs",
  },
  {
    triggers: ["link.forget_wifi.ios", "link.forget_wifi.iphone"],
    value: `https://stanford.service-now.com/student_services?id=kb_article&number=KB00018427`,
    description:
      "Link to instructions for forgetting Wi-Fi networks on iPhones",
  },
  {
    triggers: ["link.forget_wifi.android"],
    value: `https://stanford.service-now.com/student_services?id=kb_article&number=KB00018428`,
    description:
      "Link to instructions for forgetting Wi-Fi networks on Android phones",
  },
  {
    triggers: [
      "link.disable_private_address",
      "link.disable_private_mac_address",
      "link.disable_random_address",
      "link.disable_random_mac_address",
    ],
    value: `https://stanford.service-now.com/student_services?id=kb_article&sys_id=6126c5ca1b067c5098a05425604bcbb6`,
    description: "Link to instructions for disabling a randomized MAC address",
  },
  {
    triggers: ["link.gsb_registration"],
    value: `http://gsbentreg.stanford.edu/`,
    description: "Link to GSB's device registration Google form.",
  },
  {
    triggers: [
      "link.enrollment_quiz",
      "link.enrollment_questionnaire",
      "link.enrollment",
    ],
    value: `https://uit.stanford.edu/service/enrollment`,
    description: "Link to Enrollment Questionnaire page",
  },
  {
    triggers: [
      "link.enrollment_quiz.mac",
      "link.enrollment_quiz.macbook",
      "link.enrollment_quiz.macos",
      "link.enrollment_quiz.osx",
      "link.enrollment_questionnaire.mac",
      "link.enrollment_questionnaire.macbook",
      "link.enrollment_questionnaire.macos",
      "link.enrollment_questionnaire.osx",
      "link.enrollment.mac",
      "link.enrollment.macbook",
      "link.enrollment.macos",
      "link.enrollment.osx",
    ],
    value: `https://uit.stanford.edu/service/enrollment/mac`,
    description: "Link to Enrollment Questionnaire for MacBooks",
  },
  {
    triggers: [
      "link.enrollment_quiz.windows",
      "link.enrollment_quiz.pc",
      "link.enrollment_questionnaire.windows",
      "link.enrollment_questionnaire.pc",
      "link.enrollment.windows",
      "link.enrollment.pc",
    ],
    value: `https://uit.stanford.edu/service/enrollment/windows`,
    description: "Link to Enrollment Questionnaire for Windows PCs",
  },
  {
    triggers: [
      "link.enrollment_quiz.mobile",
      "link.enrollment_quiz.ios",
      "link.enrollment_quiz.iphone",
      "link.enrollment_quiz.android",
      "link.enrollment_questionnaire.mobile",
      "link.enrollment_questionnaire.ios",
      "link.enrollment_questionnaire.iphone",
      "link.enrollment_questionnaire.android",
      "link.enrollment.mobile",
      "link.enrollment.ios",
      "link.enrollment.iphone",
      "link.enrollment.android",
    ],
    value: `https://uit.stanford.edu/service/enrollment/mobiledevice`,
    description: "Link to Enrollment Questionnaire for Mobile Device",
  },
  {
    triggers: [
      "phone_number.sts",
      "phone_number.pts",
      "phone_number.us",
      "phone_number.ours",
    ],
    value: `(650) 723-9204`,
    description: "Phone number for PTS",
  },
  {
    triggers: [
      "phone_number.uit",
      "phone_number.helpsu",
      "phone_number.help_su",
      "phone_number.it",
    ],
    value: `(650) 725-4357`,
    description: "Phone number for UIT/HelpSU",
  },
  {
    triggers: [
      "phone_number.med_school",
      "phone_number.som",
      "phone_number.medical_school",
    ],
    value: `(650) 725-8000`,
    description: "Phone number for SoM IT",
  },
  {
    triggers: ["icon.mydevices.compliant", "icon.my_devices.compliant"],
    value: `[code]<img style="height:1em;vertical-align:-.15em" src="https://raw.githubusercontent.com/FiggChristian/PTS-Scripts/main/.github/assets/mydevices-compliant.svg" alt=""/>[/code]`,
    description: `Inserts a "<img style="height:1em" src="https://raw.githubusercontent.com/FiggChristian/PTS-Scripts/main/.github/assets/mydevices-compliant.svg" alt="green checkmark icon"/>"`,
  },
  {
    triggers: [
      "icon.mydevices.n/a",
      "icon.mydevices.na",
      "icon.my_devices.n/a",
      "icon.my_devices.na",
    ],
    value: `[code]<img style="height:1em;vertical-align:-.15em" src="https://raw.githubusercontent.com/FiggChristian/PTS-Scripts/main/.github/assets/mydevices-na.svg" alt=""/>[/code]`,
    description: `Inserts a "<img style="height:1em" src="https://raw.githubusercontent.com/FiggChristian/PTS-Scripts/main/.github/assets/mydevices-na.svg" alt="gray dash icon"/>"`,
  },
  {
    triggers: [
      "icon.mydevices.not_compliant",
      "icon.mydevices.uncompliant",
      "icon.mydevices.incompliant",
      "icon.mydevices.noncompliant",
      "icon.my_devices.not_compliant",
      "icon.my_devices.uncompliant",
      "icon.my_devices.incompliant",
      "icon.my_devices.noncompliant",
    ],
    value: `[code]<img style="height:1em;vertical-align:-.15em" src="https://raw.githubusercontent.com/FiggChristian/PTS-Scripts/main/.github/assets/mydevices-not_compliant.svg" alt=""/>[/code]`,
    description: `Inserts a "<img style="height:1em" src="https://raw.githubusercontent.com/FiggChristian/PTS-Scripts/main/.github/assets/mydevices-not_compliant.svg" alt="red X icon"/>"`,
  },
  {
    triggers: ["icon.info", "icon.information"],
    value: `[code]<img style="height:1em;vertical-align:-.15em" src="https://raw.githubusercontent.com/FiggChristian/PTS-Scripts/main/.github/assets/info.svg" alt="info icon"/>[/code]`,
    description: `Inserts a "<img style="height:1em" src="https://raw.githubusercontent.com/FiggChristian/PTS-Scripts/main/.github/assets/info.svg" alt="circled info icon"/>"`,
  },
  {
    triggers: ["icon.apple", "icon.apple_logo", "icon.apple_menu"],
    value: `[code]<img style="height:1em;vertical-align:-.15em" src="https://raw.githubusercontent.com/FiggChristian/PTS-Scripts/main/.github/assets/apple.svg" alt="Apple logo"/>[/code]`,
    description: `Inserts a "<img style="height:1em" src="https://raw.githubusercontent.com/FiggChristian/PTS-Scripts/main/.github/assets/apple.svg" alt="black Apple logo"/>"`,
  },
];

export const replacementByTrigger: Record<Trigger, Replacement> = {};
for (const replacement of replacements) {
  for (const trigger of replacement.triggers) {
    replacementByTrigger[trigger.trim().toLowerCase()] = replacement;
  }
  // Dedent any string values so we don't have to do it later.
  if ("value" in replacement) {
    replacement.value = dedent(replacement.value);
  }
}
