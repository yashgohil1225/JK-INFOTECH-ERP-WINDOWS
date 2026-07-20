'''Add default_tax_rate column to companies table

Revision ID: add_default_tax_rate_20240626_01
Revises: a448bea5d7b2
Create Date: 2024-06-26 12:44:12
'''
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "add_default_tax_rate_20240626_01"
down_revision = "a448bea5d7b2"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column(
        "companies",
        sa.Column("default_tax_rate", sa.Float(), nullable=True),
    )

def downgrade() -> None:
    op.drop_column("companies", "default_tax_rate")
