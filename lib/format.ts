export function formatMoney(amount: number) { return `Rwf ${Math.round(amount).toLocaleString("en-RW")}` }
export function formatPhone(phone: string) { return phone.startsWith("+250") ? phone : `+250 ${phone}` }
export function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() }
export function formatDate(value: string) { return new Intl.DateTimeFormat("en-RW", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) }
