// nodemailer (biar TS nggak merah)
declare module "nodemailer";

// styled-jsx typings (biar <style jsx> / <style jsx global> nggak merah)
import "react";

declare module "react" {
  interface StyleHTMLAttributes<T> {
    jsx?: boolean;
    global?: boolean;
  }
}