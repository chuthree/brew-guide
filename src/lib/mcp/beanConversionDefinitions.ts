import type { Schema } from './toolDefinitions';

const groupMigration: Schema = {
  type: 'string',
  enum: ['green', 'roasted', 'remove'],
};
const text = (maxLength = 128): Schema => ({
  type: 'string',
  minLength: 1,
  maxLength,
});
const object = (
  properties: Record<string, Schema>,
  required: string[]
): Schema => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
export const beanConversionDefinitions: Array<{
  name: string;
  description: string;
  schema: Schema;
  write?: boolean;
  destructive?: boolean;
  access?: 'delete';
}> = [
  {
    name: 'preview_convert_roasted_to_green',
    description:
      'Preview migration of a historical roasted bean that actually represents green inventory. Replaces original bean; deletes its adjustment/quick records; migrates ordinary brew notes to newly produced roasted stock and creates canonical roasting lineage. Present exact impact before confirming. Rejects existing provenance/dependent lineage or contradictory stock history.',
    schema: object({ id: text(), groupMigration }, ['id']),
  },
  {
    name: 'convert_roasted_to_green',
    access: 'delete',
    write: true,
    destructive: true,
    description:
      'Perform only explicitly confirmed historical roasted-to-green migration from a fresh preview. Deletes original bean and its change records, keeps ordinary notes and photos, creates new green and optional roasted beans. Requires delete permission; irreversible graph replacement, not a stock field edit.',
    schema: object(
      {
        requestId: { ...text(), minLength: 8 },
        id: text(),
        expectedVersion: { ...text(64), minLength: 64 },
        confirmationToken: text(),
        groupMigration,
        confirmAction: { type: 'string', enum: ['convert_roasted_to_green'] },
      },
      [
        'requestId',
        'id',
        'expectedVersion',
        'confirmationToken',
        'confirmAction',
      ]
    ),
  },
];
