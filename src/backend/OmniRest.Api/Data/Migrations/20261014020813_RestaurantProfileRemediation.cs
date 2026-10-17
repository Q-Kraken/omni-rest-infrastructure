using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OmniRest.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RestaurantProfileRemediation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "created_at",
                schema: "public",
                table: "special_hours",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "updated_at",
                schema: "public",
                table: "special_hours",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP");

            // restaurants.website_url is deliberately absent here: Phase 8
            // (20260920120000_Phase8RestaurantWebsiteUrl) already adds it with the same
            // character varying(2048) nullable shape, and this migration runs after it. Adding it again
            // would fail with Postgres 42701 on any database that has taken the Phase 8 upgrade.

            migrationBuilder.AlterColumn<string>(
                name: "postal_code",
                schema: "public",
                table: "restaurant_addresses",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "created_at",
                schema: "public",
                table: "special_hours");

            migrationBuilder.DropColumn(
                name: "updated_at",
                schema: "public",
                table: "special_hours");

            // website_url is Phase 8's column to drop, not this migration's.

            migrationBuilder.AlterColumn<string>(
                name: "postal_code",
                schema: "public",
                table: "restaurant_addresses",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20,
                oldNullable: true);
        }
    }
}
