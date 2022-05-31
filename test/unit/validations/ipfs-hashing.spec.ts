import { Hashing } from 'dcl-catalyst-commons'
import { ADR_45_TIMESTAMP } from '../../../src'
import { ipfsHashing } from '../../../src/validations/ipfs-hashing'
import { buildDeployment } from '../../setup/deployments'
import { buildEntity } from '../../setup/entity'
import { buildComponents } from '../../setup/mock'

describe('IPFS hashing', () => {
  const components = buildComponents()
  const timestamp = ADR_45_TIMESTAMP + 1
  it(`When an entity's id is not an ipfs hash, then it fails`, async () => {
    const entity = buildEntity({
      id: 'QmTBPcZLFQf1rZpZg2T8nMDwWRoqeftRdvkaexgAECaqHp',
      timestamp
    })
    const deployment = buildDeployment({ entity })

    const result = await ipfsHashing.validate(deployment, components)

    expect(result.ok).toBeFalsy()
    expect(result.errors).toContain(
      `This hash 'QmTBPcZLFQf1rZpZg2T8nMDwWRoqeftRdvkaexgAECaqHp' is not valid. It should be IPFS v2 format.`
    )
  })

  it(`When an entity's id is not an ipfs hash, then it fails`, async () => {
    const content = [
      {
        file: 'someFile',
        hash: 'QmTBPcZLFQf1rZpZg2T8nMDwWRoqeftRdvkaexgAECaqHp'
      }
    ]
    const entity = buildEntity({ timestamp, content })
    const deployment = buildDeployment({ entity })

    const result = await ipfsHashing.validate(deployment, components)

    expect(result.ok).toBeFalsy()
    expect(result.errors).toContain(
      `This hash 'QmTBPcZLFQf1rZpZg2T8nMDwWRoqeftRdvkaexgAECaqHp' is not valid. It should be IPFS v2 format.`
    )
  })

  it(`when all entity's hashes are ipfs, then no errors are reported`, async () => {
    const someHash = await Hashing.calculateIPFSHash(Buffer.from('some file'))
    const entity = buildEntity({
      content: [{ file: 'someFile.png', hash: someHash }],
      timestamp
    })

    const deployment = buildDeployment({ entity })

    const result = await ipfsHashing.validate(deployment, components)
    expect(result.ok).toBeTruthy()
  })

  it(`When an entity timestamp is previous to ADR_45, then no validation is run`, async () => {
    const content = [
      {
        file: 'someFile',
        hash: 'QmTBPcZLFQf1rZpZg2T8nMDwWRoqeftRdvkaexgAECaqHp'
      }
    ]
    const entity = buildEntity({ content, timestamp: ADR_45_TIMESTAMP - 1 })
    const deployment = buildDeployment({ entity })

    const result = await ipfsHashing.validate(deployment, components)

    expect(result.ok).toBeTruthy()
  })
})
