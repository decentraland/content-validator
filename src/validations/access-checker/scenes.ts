import ms from 'ms'
import { fromErrors, Validation } from '../../types'

const SCENE_LOOKBACK_TIME = ms('5m')

/**
 * Checks if the given address has access to the given parcel at the given timestamp.
 * @public
 */
export const scenes: Validation = {
  validate: async ({ externalCalls, subGraphs }, deployment) => {
    const { entity } = deployment
    const { pointers, timestamp } = entity

    let block: number
    try {
      // Check that the address has access (we check both the present and the 5 min into the past to avoid synchronization issues in the blockchain)
      const blockInfo = await subGraphs.l1BlockSearch.findBlockForTimestamp(timestamp - SCENE_LOOKBACK_TIME)
      if (blockInfo === undefined) {
        return fromErrors('Deployment timestamp is invalid, no matching block found')
      }

      block = blockInfo.block
    } catch (err: any) {
      return fromErrors(`Deployment timestamp is invalid, no matching block found: ${err}`)
    }

    const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)

    const errors = []
    const lowerCasePointers = pointers.map((pointer) => pointer.toLowerCase())

    for (const pointer of lowerCasePointers) {
      const pointerParts: string[] = pointer.split(',')
      if (pointerParts.length === 2) {
        const x: number = parseInt(pointerParts[0], 10)
        const y: number = parseInt(pointerParts[1], 10)
        try {
          const hasAccess = await subGraphs.L1.checker.checkLAND(ethAddress, x, y, block)
          if (!hasAccess) {
            errors.push(`The provided Eth Address does not have access to the following parcel: (${x},${y})`)
          }
        } catch (e) {
          errors.push(`The provided Eth Address does not have access to the following parcel: (${x},${y}). ${e}`)
        }
      } else {
        errors.push(
          `Scene pointers should only contain two integers separated by a comma, for example (10,10) or (120,-45). Invalid pointer: ${pointer}`
        )
      }
    }

    return fromErrors(...errors)
  }
}
