export const isInstance = <Class>(
  object: unknown,
  type: { new (): Class; name: string }
): object is Class => {
  // ServiceNow (disgustingly) overwrites the "Element" class with their own stupid constructor,
  // which completely messes up checking instanceof Element, so we have to set Element manually to
  // "Element" here to prevent us from using the ServiceNow constructor.
  // (i.e., Element.name !== "Element")
  const name = type === Element ? "Element" : type.name;
  return isInstanceFromName(object, name);
};
export const isInstanceFromName = (object: unknown, type: string): boolean => {
  for (
    let currWindow: Window = window;
    currWindow.parent !== currWindow;
    currWindow = currWindow.parent
  ) {
    const cls = (currWindow as unknown as Record<string, { new (): unknown }>)[
      type
    ];
    if (cls && object instanceof cls) {
      return true;
    }
  }
  const cls = window.top
    ? (window.top as unknown as Record<string, { new (): unknown }>)[type]
    : null;
  return cls ? object instanceof cls : false;
};

export default isInstance;
