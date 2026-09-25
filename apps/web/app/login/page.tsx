import { redirect } from 'next/navigation';

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;
  const destination = new URLSearchParams({ mode: 'login' });
  const next = singleValue(query.next);
  const error = singleValue(query.error);
  if (next) destination.set('next', next);
  if (error) destination.set('error', error);
  redirect(`/auth?${destination.toString()}`);
}

function singleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
