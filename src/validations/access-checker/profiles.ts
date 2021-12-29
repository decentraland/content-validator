import { Pointer } from "dcl-catalyst-commons"
import { ethers } from "ethers"
import { OK, Validation, validationFailed } from "../../types"

export const ownership: Validation = {
  validate: async ({ deployment, externalCalls }) => {
    const pointers = deployment.entity.pointers
    const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)

    if (pointers.length !== 1)
      return validationFailed(`Only one pointer is allowed when you create a Profile. Received: ${pointers}`)

    const pointer: Pointer = pointers[0].toLowerCase()

    if (pointer.startsWith("default") && !externalCalls.isAddressOwnedByDecentraland(ethAddress))
      return validationFailed(`Only Decentraland can add or modify default profiles`)

    if (!ethers.utils.isAddress(pointer)) return validationFailed(`The given pointer is not a valid ethereum address.`)

    if (pointer !== ethAddress.toLowerCase())
      return validationFailed(
        `You can only alter your own profile. The pointer address and the signer address are different (pointer:${pointer} signer: ${ethAddress.toLowerCase()}).`
      )

    return OK
  },
}
