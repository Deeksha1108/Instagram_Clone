import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { AUTH_MESSAGES } from 'src/modules/auth/response/auth.response';

@ValidatorConstraint({ name: 'IsAdult', async: false })
export class IsAdultValidator implements ValidatorConstraintInterface {
  validate(dateOfBirth: string, args: ValidationArguments): boolean {
    const dob = new Date(dateOfBirth);

    if (isNaN(dob.getTime())) return false;

    const today = new Date();

    let age = today.getFullYear() - dob.getFullYear();

    const monthDiff = today.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    return age >= 18;
  }

  defaultMessage(args: ValidationArguments): string {
    return AUTH_MESSAGES.USER_UNDERAGE;
  }
}