import { isAddress } from '@ethersproject/address'
import { Pointer } from 'dcl-catalyst-commons'
import { OK, Validation, validationFailed } from '../../types'
import { createTheGraph } from './the-graph-client'

/**
 * Validate that the pointers are valid, and that the Ethereum address has write access to them
 * @public
 */
export const profiles: Validation = {
  validate: async ({ deployment, externalCalls }) => {
    const pointers = deployment.entity.pointers
    const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)

    if (pointers.length !== 1)
      return validationFailed(
        `Only one pointer is allowed when you create a Profile. Received: ${pointers}`
      )

    const pointer: Pointer = pointers[0].toLowerCase()

    if (pointer.startsWith('default')) {
      if (!externalCalls.isAddressOwnedByDecentraland(ethAddress))
        return validationFailed(
          `Only Decentraland can add or modify default profiles`
        )
    } else if (!isAddress(pointer)) {
      return validationFailed(
        `The given pointer is not a valid ethereum address.`
      )
    } else if (pointer !== ethAddress.toLowerCase()) {
      return validationFailed(
        `You can only alter your own profile. The pointer address and the signer address are different (pointer:${pointer} signer: ${ethAddress.toLowerCase()}).`
      )
    }

    const collectionsSubgraph: string = externalCalls.subgraphs.L1.collections
    const maticCollectionsSubgraph: string = externalCalls.subgraphs.L2.collections
    const ensSubgraph: string = externalCalls.subgraphs.L2.ensOwner
    const thirdPartyRegistrySubgraph: string = externalCalls.subgraphs.L2.thirdPartyRegistry

    const theGraph = createTheGraph(externalCalls, {
      ensSubgraph,
      collectionsSubgraph,
      maticCollectionsSubgraph,
      thirdPartyRegistrySubgraph
    })

    const response = await theGraph.checkForWearablesOwnership([])
    console.log(response)
    return OK
  }
}
