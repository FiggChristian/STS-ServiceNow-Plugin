export enum TicketState {
  New,
  Active,
  Pending,
  Resolved,
}

export enum AssignmentGroup {
  Triage = "VPSA LTS Student Technology Services Triage",
  Escalation = "VPSA LTS Student Technology Services Escalation",
  ResNet = "UIT ResNet",
  ITOC = "UIT IT Operations Center",
}

export interface ChangeableFields {
  /**
   * The Comments to add to the ticket.
   */
  additional_comments: string;
  /**
   * The Work Notes to add to the ticket.
   */
  work_notes: string;
  /**
   * The Close Notes to add to the ticket.
   */
  close_notes: string;
  /**
   * The assignment group to assign the ticket to.
   */
  assignment_group: AssignmentGroup;
  /**
   * The state to change the ticket to.
   */
  state: TicketState;
  /**
   * The person to change the ticket's assigned to field to.
   */
  assigned_to: string;
}

export interface Macro {
  /**
   * The name to show in the macro selector.
   */
  name: string;
  /**
   * The description to show underneath the name in the macro selector.
   */
  description: string;
  /**
   * A set of fields to change on the ticket when the macro is applied.
   */
  fields: Partial<ChangeableFields>;
}

export interface Components {
  root: HTMLElement;
  backdrop: HTMLElement;
  leftPanel: HTMLElement;
  rightPanel: HTMLElement;
  macroList: HTMLElement;
  previewBody: HTMLElement;
  header: HTMLElement;
  search: HTMLInputElement;
}
