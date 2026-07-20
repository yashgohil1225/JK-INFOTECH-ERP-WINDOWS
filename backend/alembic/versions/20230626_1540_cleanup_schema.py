# -*- coding: utf-8 -*-
"""Cleanup schema – drop obsolete columns and add default_hsn_sac_code.

Revision ID: 20230626_1540_cleanup_schema
Revises: a448bea5d7b2  # latest known migration
Create Date: 2026-06-26 15:40:00
"""

from alembic import op
# pyrefly: ignore [missing-import]
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20230626_1540_cleanup_schema"
down_revision = "be3903c5d892"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new column to companies (if not already present)
    op.add_column(
        "companies",
        sa.Column("default_hsn_sac_code", sa.String(50), nullable=True),
    )

    # Drop obsolete columns from companies
    for col in [
        "factory_address_1",
        "factory_address_2",
        "factory_address_3",
        "factory_address_4",
        "owner_name",
        "fax_no",
        "email_password",
        "company_password",
        "website",
        "cin_no",
        "assessee_category",
        "is_tds_applicable",
        "is_tcs_applicable",
        "gst_apply_date",
        "composition_date",
        "fiscal_year_start",
        "fiscal_year_end",
    ]:
        op.drop_column("companies", col, if_exists=True)

    # Drop unused columns from customers
    for col in [
        "sub_ledger",
        "contact_person",
        "fax_no",
        "gstin_date",
        "aadhaar_no",
        "consider_supply_type",
        "broker_name",
        "brokerage_percentage",
        "transport_name",
        "shipping_name",
        "distance_km",
        "narration",
    ]:
        op.drop_column("customers", col, if_exists=True)

    # Drop unused columns from suppliers
    for col in [
        "sub_ledger",
        "contact_person",
        "fax_no",
        "gstin_date",
        "aadhaar_no",
        "consider_supply_type",
        "broker_name",
        "brokerage_percentage",
        "transport_name",
        "shipping_name",
        "distance_km",
        "narration",
    ]:
        op.drop_column("suppliers", col, if_exists=True)


def downgrade() -> None:
    # Re‑add dropped columns (as nullable, generic types) – for manual rollback
    # Companies
    op.drop_column("companies", "default_hsn_sac_code", if_exists=True)
    for col, typ in [
        ("factory_address_1", sa.Text),
        ("factory_address_2", sa.Text),
        ("factory_address_3", sa.Text),
        ("factory_address_4", sa.Text),
        ("owner_name", sa.Text),
        ("fax_no", sa.Text),
        ("email_password", sa.Text),
        ("company_password", sa.Text),
        ("website", sa.Text),
        ("cin_no", sa.Text),
        ("assessee_category", sa.Text),
        ("is_tds_applicable", sa.Boolean),
        ("is_tcs_applicable", sa.Boolean),
        ("gst_apply_date", sa.Date),
        ("composition_date", sa.Date),
        ("fiscal_year_start", sa.Date),
        ("fiscal_year_end", sa.Date),
    ]:
        op.add_column("companies", sa.Column(col, typ, nullable=True))

    # Customers & Suppliers – generic restoration
    for table in ("customers", "suppliers"):
        for col, typ in [
            ("sub_ledger", sa.Text),
            ("contact_person", sa.Text),
            ("fax_no", sa.Text),
            ("gstin_date", sa.Date),
            ("aadhaar_no", sa.Text),
            ("consider_supply_type", sa.Boolean),
            ("broker_name", sa.Text),
            ("brokerage_percentage", sa.Numeric),
            ("transport_name", sa.Text),
            ("shipping_name", sa.Text),
            ("distance_km", sa.Numeric),
            ("narration", sa.Text),
        ]:
            op.add_column(table, sa.Column(col, typ, nullable=True))
