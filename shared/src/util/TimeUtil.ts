export class TimeUtil {
   public static getCurrentTimestamp(): number {
      return performance.now() + performance.timeOrigin;
   }
}
