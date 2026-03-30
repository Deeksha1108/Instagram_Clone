import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'IsE164Phone', async: false })
export class IsE164PhoneConstraint implements ValidatorConstraintInterface {
  validate(value: string | undefined): boolean {
    if (value === undefined || value === null) return true;
    return /^\+[1-9]\d{1,14}$/.test(value);
  }

  defaultMessage(): string {
    return 'Please enter a valid phone number.';
  }
}