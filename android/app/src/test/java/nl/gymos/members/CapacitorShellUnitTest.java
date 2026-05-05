package nl.gymos.members;

import static org.junit.Assert.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.junit.Test;

public class CapacitorShellUnitTest {

    private static String readAppAsset(String relativePath) throws IOException {
        Path appDir = Paths.get(System.getProperty("user.dir"));
        Path[] candidates = {
            appDir.resolve(relativePath),
            appDir.resolve("app").resolve(relativePath),
            appDir.resolve("../mobile-shell/index.html").normalize(),
            appDir.resolve("../../mobile-shell/index.html").normalize()
        };

        for (Path candidate : candidates) {
            if (Files.exists(candidate)) {
                return new String(Files.readAllBytes(candidate), StandardCharsets.UTF_8);
            }
        }

        throw new IOException("Could not find Android app asset: " + relativePath);
    }

    @Test
    public void packagedShellHasExplicitMemberJourneyEntrypoints() throws IOException {
        String html = readAppAsset("src/main/assets/public/index.html");

        assertTrue(html.contains("data-qa-flow=\"login\""));
        assertTrue(html.contains("data-qa-flow=\"reserve\""));
        assertTrue(html.contains("data-qa-flow=\"cancel-reservation\""));
        assertTrue(html.contains("data-qa-flow=\"payments\""));
        assertTrue(html.contains("data-qa-flow=\"pause-request\""));
        assertTrue(html.contains("data-qa-flow=\"account-delete\""));
        assertTrue(html.contains("data-open-portal=\"/reserve#mijn-reserveringen\""));
        assertTrue(html.contains("data-open-portal=\"/reserve#contracten-betalingen\""));
        assertTrue(html.contains("data-open-portal=\"/reserve#ledenservice\""));
        assertTrue(html.contains("data-open-portal=\"/reserve#account-verwijderen\""));
    }

    @Test
    public void packagedShellCoversNativePaymentOfflineAndResumeStates() throws IOException {
        String html = readAppAsset("src/main/assets/public/index.html");

        assertTrue(html.contains("window.GymOSNativePayments"));
        assertTrue(html.contains("isMolliePaymentUrl"));
        assertTrue(html.contains("openPaymentCheckout"));
        assertTrue(html.contains("handlePaymentReturn"));
        assertTrue(html.contains("handleAppResume"));
        assertTrue(html.contains("browserFinished"));
        assertTrue(html.contains("appStateChange"));
        assertTrue(html.contains("simulateNetworkForQa"));
        assertTrue(html.contains("Betaling onderbroken of bankapp gesloten"));
        assertTrue(html.contains("Offline pas actief"));
    }
}
