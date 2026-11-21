import argparse
import getpass
import re

from argon2 import PasswordHasher
from sqlalchemy import select

from .db import Base, DEMO, Session, User, engine


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["create-moderator", "create-administrator"])
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True)
    args = parser.parse_args()
    email, name = args.email.strip().lower(), args.name.strip()
    if len(email) > 254 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email) or not 0 < len(name) <= 100:
        parser.error("Enter a valid email and a name up to 100 characters.")
    role = "administrator" if args.action == "create-administrator" else "moderator"
    password = getpass.getpass(role.capitalize() + " password: ")
    if not 8 <= len(password) <= 128 or password != getpass.getpass("Confirm password: "):
        parser.error("Passwords must match and contain 8–128 characters.")
    if DEMO:
        Base.metadata.create_all(engine)
    with Session.begin() as db:
        if db.scalar(select(User.id).where(User.email == email)):
            parser.error("Email is already registered.")
        db.add(User(email=email, name=name, password=PasswordHasher().hash(password), role=role))
    print(role.capitalize() + " created.")


if __name__ == "__main__":
    main()
