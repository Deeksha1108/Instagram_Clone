import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { AUTH_MESSAGES } from 'src/modules/auth/response/auth.response';

@ValidatorConstraint({ name: 'SendOtpValidator', async: false })
export class SendOtpValidator implements ValidatorConstraintInterface {
  validate(_: any, args: any): boolean {
    const { email, phone, countryCode } = args.object;

    if ((email && phone) || (!email && !phone)) {
      return false;
    }

    if (email) return true;

    if (phone) {
      if (!countryCode) return false;
      return true;
    }
    return false;
  }

  defaultMessage(args: any): string {
    const { email, phone, countryCode } = args.object;
    if ((email && phone) || (!email && !phone)) {
      return AUTH_MESSAGES.PROVIDE_EMAIL_OR_PHONE;
    }
    if (phone && !countryCode) {
      return AUTH_MESSAGES.COUNTRY_CODE_REQUIRED;
    }
    return AUTH_MESSAGES.INVALID_PHONE_NUMBER;
  }
}
