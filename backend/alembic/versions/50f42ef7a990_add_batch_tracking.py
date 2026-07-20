"""add_batch_tracking

Revision ID: 50f42ef7a990
Revises: 28ad1d181fc3
Create Date: 2026-06-23 22:32:15.121697

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '50f42ef7a990'
down_revision: Union[str, None] = '28ad1d181fc3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. Create 'batches' table if it doesn't exist
    if 'batches' not in tables:
        op.create_table(
            'batches',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('company_id', sa.UUID(), nullable=False),
            sa.Column('product_id', sa.UUID(), nullable=False),
            sa.Column('batch_number', sa.String(length=100), nullable=False),
            sa.Column('manufacturing_date', sa.Date(), nullable=True),
            sa.Column('expiry_date', sa.Date(), nullable=True),
            sa.Column('cost_price', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0'),
            sa.Column('sale_price', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0'),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('company_id', 'product_id', 'batch_number', name='uq_batches_product_batch')
        )
        op.create_index(op.f('ix_batches_company_id'), 'batches', ['company_id'], unique=False)
        op.create_index(op.f('ix_batches_product_id'), 'batches', ['product_id'], unique=False)
        op.create_index(op.f('ix_batches_batch_number'), 'batches', ['batch_number'], unique=False)
        op.create_index(op.f('ix_batches_expiry_date'), 'batches', ['expiry_date'], unique=False)

    # 2. Add batch_id to stock_entries, purchase_bill_items, invoice_items, debit_note_items, credit_note_items
    tables_to_update = ['stock_entries', 'purchase_bill_items', 'invoice_items', 'debit_note_items', 'credit_note_items']
    for table_name in tables_to_update:
        columns = [col['name'] for col in inspector.get_columns(table_name)]
        if 'batch_id' not in columns:
            op.add_column(table_name, sa.Column('batch_id', sa.UUID(), nullable=True))
            
            # Create index and foreign key
            op.create_index(op.f(f'ix_{table_name}_batch_id'), table_name, ['batch_id'], unique=False)
            op.create_foreign_key(
                f'{table_name}_batch_id_fkey',
                table_name, 'batches',
                ['batch_id'], ['id'],
                ondelete='SET NULL'
            )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # Drop foreign keys and columns
    tables_to_update = ['stock_entries', 'purchase_bill_items', 'invoice_items', 'debit_note_items', 'credit_note_items']
    for table_name in tables_to_update:
        if table_name in tables:
            columns = [col['name'] for col in inspector.get_columns(table_name)]
            if 'batch_id' in columns:
                # Drop foreign key constraint
                op.drop_constraint(f'{table_name}_batch_id_fkey', table_name, type_='foreignkey')
                # Drop index
                op.drop_index(op.f(f'ix_{table_name}_batch_id'), table_name=table_name)
                # Drop column
                op.drop_column(table_name, 'batch_id')

    # Drop batches table
    if 'batches' in tables:
        op.drop_table('batches')

    # ### end Alembic commands ###
