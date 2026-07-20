"""add purchase_bill_items columns and fix schema

Revision ID: c1a2b3d4e5f6
Revises: a448bea5d7b2
Create Date: 2026-06-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c1a2b3d4e5f6'
down_revision: Union[str, None] = 'a448bea5d7b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add missing columns to purchase_bill_items
    conn = op.get_bind()
    
    # Check and add quantity_2
    result = conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='purchase_bill_items' AND column_name='quantity_2'"
    ))
    if not result.fetchone():
        op.add_column('purchase_bill_items', sa.Column('quantity_2', sa.Numeric(15, 2), nullable=False, server_default='0'))
    
    # Check and add quantity_3
    result = conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='purchase_bill_items' AND column_name='quantity_3'"
    ))
    if not result.fetchone():
        op.add_column('purchase_bill_items', sa.Column('quantity_3', sa.Numeric(15, 2), nullable=False, server_default='0'))
    
    # Check and add p_challan_no
    result = conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='purchase_bill_items' AND column_name='p_challan_no'"
    ))
    if not result.fetchone():
        op.add_column('purchase_bill_items', sa.Column('p_challan_no', sa.String(50), nullable=True))
    
    # Fix duplicate fiscal_years: delete duplicates keeping the oldest row
    conn.execute(sa.text("""
        DELETE FROM fiscal_years
        WHERE id IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id, label ORDER BY created_at) AS rn
                FROM fiscal_years
            ) t
            WHERE rn > 1
        )
    """))
    
    # Add unique constraint to fiscal_years if it doesn't exist
    result = conn.execute(sa.text(
        "SELECT constraint_name FROM information_schema.table_constraints "
        "WHERE table_name='fiscal_years' AND constraint_name='uq_fiscal_years_label'"
    ))
    if not result.fetchone():
        op.create_unique_constraint('uq_fiscal_years_label', 'fiscal_years', ['company_id', 'label'])

    # Fix customers opening_balance_type nulls
    conn.execute(sa.text(
        "UPDATE customers SET opening_balance_type = 'DEBIT' WHERE opening_balance_type IS NULL"
    ))

    # Fix suppliers opening_balance_type nulls 
    conn.execute(sa.text(
        "UPDATE suppliers SET opening_balance_type = 'DEBIT' WHERE opening_balance_type IS NULL"
    ))


def downgrade() -> None:
    # Remove the added columns
    op.drop_column('purchase_bill_items', 'p_challan_no')
    op.drop_column('purchase_bill_items', 'quantity_3')
    op.drop_column('purchase_bill_items', 'quantity_2')
    op.drop_constraint('uq_fiscal_years_label', 'fiscal_years', type_='unique')
