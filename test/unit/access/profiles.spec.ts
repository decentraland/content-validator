import { profiles } from '../../../src/validations/access-checker/profiles'
import {
  buildDeployment,
  buildProfileDeployment
} from '../../setup/deployments'
import {buildComponents, buildExternalCalls, realQueryGraph} from '../../setup/mock'
import { buildEntity } from '../../setup/entity'
import { EntityType } from '@dcl/schemas'
import { VALID_PROFILE_METADATA } from '../../setup/profiles'
import { ADR_XXX_TIMESTAMP } from '../../../src'

describe('Access: profiles', () => {
  it('When a non-decentraland address tries to deploy an default profile, then an error is returned', async () => {
    const deployment = buildProfileDeployment(['Default10'])
    const externalCalls = buildExternalCalls()

    const response = await profiles.validate(
      buildComponents({ externalCalls }),
      deployment
    )
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      'Only Decentraland can add or modify default profiles'
    )
  })

  it('When a decentraland address tries to deploy an default profile, then it is allowed', async () => {
    const someValidAddress = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f'
    const deployment = buildProfileDeployment(['Default10'])
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => true,
      ownerAddress: () => someValidAddress
    })

    const response = await profiles.validate(
      buildComponents({ externalCalls }),
      deployment
    )
    expect(response.ok).toBeTruthy()
  })

  it('When a profile is created by its own address, then it is valid', async () => {
    const someAddress = '0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4c'
    const deployment = buildProfileDeployment([someAddress])
    const externalCalls = buildExternalCalls({
      ownerAddress: () => someAddress
    })

    const response = await profiles.validate(
      buildComponents({ externalCalls }),
      deployment
    )
    expect(response.ok).toBeTruthy()
  })

  it('When a profile is created and too many pointers are sent, the access check fails', async () => {
    const addresses = ['some-address-1', 'some-address=2']
    const deployment = buildProfileDeployment(addresses)
    const externalCalls = buildExternalCalls({
      ownerAddress: () => 'some-address'
    })

    const response = await profiles.validate(
      buildComponents({ externalCalls }),
      deployment
    )
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      `Only one pointer is allowed when you create a Profile. Received: ${addresses}`
    )
  })

  it('When a profile is created and the pointers does not match the signer, the access check fails', async () => {
    const pointer = '0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4c'
    const address = '0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4a'

    const deployment = buildProfileDeployment([pointer])
    const externalCalls = buildExternalCalls({
      ownerAddress: () => address
    })

    const response = await profiles.validate(
      buildComponents({ externalCalls }),
      deployment
    )
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      `You can only alter your own profile. The pointer address and the signer address are different (pointer:${pointer} signer: ${address}).`
    )
  })

  it('When a profile is created and the pointers are not eth addresses it fails', async () => {
    const pointer = 'someNonEthAddress'
    const address = 'anotherNonEthAddress'

    const deployment = buildProfileDeployment([pointer])
    const externalCalls = buildExternalCalls({
      ownerAddress: () => address
    })

    const response = await profiles.validate(
      buildComponents({ externalCalls }),
      deployment
    )
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      'The given pointer is not a valid ethereum address.'
    )
  })

  it('When a profile has wearables, then all wearables must be owned by the ETH address', async () => {
    const someAddress = '0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4c'

    const entity = buildEntity({
      type: EntityType.PROFILE,
      metadata: VALID_PROFILE_METADATA,
      timestamp: ADR_XXX_TIMESTAMP + 1,
      pointers: [someAddress]
    })
    const deployment = buildDeployment({ entity })

    const externalCalls = buildExternalCalls({
      ownerAddress: () => someAddress,
      queryGraph: realQueryGraph
    })

    const response = await profiles.validate(
      buildComponents({ externalCalls }),
      deployment
    )
    expect(response.ok).toBeTruthy()
  })
})
