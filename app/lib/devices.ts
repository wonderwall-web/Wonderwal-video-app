export function getDeviceId() {
  let id = localStorage.getItem("DEVICE_ID");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("DEVICE_ID", id);
  }
  return id;
}
