"""Merge heads

Revision ID: be3903c5d892
Revises: 50f42ef7a990, add_default_tax_rate_20240626_01
Create Date: 2026-06-26 14:42:18.561344

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'be3903c5d892'
down_revision: Union[str, None] = ('50f42ef7a990', 'add_default_tax_rate_20240626_01')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
