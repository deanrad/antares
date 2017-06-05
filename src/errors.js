export function ReductionError(err) {
    this.error = err
}
ReductionError.prototype = Object.create(Error.prototype)

export function ParentNotificationError(err) {
    this.error = err
}
ParentNotificationError.prototype = Object.create(Error.prototype)
