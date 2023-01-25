import ms from 'ms'
import { fromErrors, Validation } from '../../types'

/**
 * Checks if the given address has access to the given parcel at the given timestamp.
 * @public
 */
export const scenes: Validation = {
  validate: async ({ externalCalls, theGraphClient, subGraphs, logs }, deployment) => {
    const { entity } = deployment
    const { pointers, timestamp } = entity

    const logger = logs.getLogger('scenes-validator')

    const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)

    const errors = []
    const lowerCasePointers = pointers.map((pointer) => pointer.toLowerCase())

    const batch: [number, number][] = []

    for (const pointer of lowerCasePointers) {
      const pointerParts: string[] = pointer.split(',')
      if (pointerParts.length === 2) {
        const x: number = parseInt(pointerParts[0], 10)
        const y: number = parseInt(pointerParts[1], 10)

        batch.push([x, y])
      } else {
        errors.push(
          `Scene pointers should only contain two integers separated by a comma, for example (10,10) or (120,-45). Invalid pointer: ${pointer}`
        )
      }
    }

    const { blockAtDeployment, blockFiveMinBeforeDeployment } = await theGraphClient.findBlocksForTimestamp(
      timestamp,
      subGraphs.l1BlockSearch
    )

    try {
      const accessAtBlock = blockAtDeployment
        ? await subGraphs.L1.checker.checkLAND(ethAddress, batch, blockAtDeployment)
        : batch.map(() => false)
      const accessAtFiveMinBeforeBlock = blockFiveMinBeforeDeployment
        ? await subGraphs.L1.checker.checkLAND(ethAddress, batch, blockFiveMinBeforeDeployment)
        : batch.map(() => false)

      for (let i = 0; i < batch.length; i++) {
        const [x, y] = batch[i]
        const hasAccess = accessAtBlock[i] || accessAtFiveMinBeforeBlock[i]
        if (!hasAccess) {
          errors.push(`The provided Eth Address does not have access to the following parcel: (${x},${y})`)
        }
      }
    } catch (err: any) {
      logger.error(err)
      return fromErrors(`Cannot validate deployment`)
    }

    return fromErrors(...errors)
  },
}
