import { fromErrors, Validation } from "../types"

const access: Validation = {
  validate: async ({ deployment, externalCalls }) =>
    fromErrors(
      ...(await externalCalls?.hasAccess({
        ...deployment.entity,
        ethAddress: externalCalls.ownerAddress(deployment.auditInfo),
      }))
    ),
}

export default access
